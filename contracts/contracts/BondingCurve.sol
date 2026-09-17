// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {BondingCurveMath} from "./libraries/BondingCurveMath.sol";
import {IDexRouter, IDexFactory} from "./interfaces/IDexRouter.sol";
import {IParabolaFactory} from "./interfaces/IParabolaFactory.sol";

/// @title BondingCurve
/// @notice One of these is deployed per token launch. Holds the token's
///         entire curve-allocated supply, prices it with a constant-product
///         curve against Arc's native currency, and — with no admin
///         involvement — graduates the token to a public DEX pool once
///         enough real value has been raised.
///
/// @dev THE SINGLE MOST IMPORTANT PROPERTY OF THIS CONTRACT:
///      Graduation is triggered by the buy() call that crosses the
///      threshold, executed by this contract's own code, in the same or a
///      later transaction that ANYONE can call — never by a privileged
///      off-chain "service account" or admin-only function. This is a
///      direct response to the real pump.fun exploit of May 2024, where an
///      attacker used a compromised centralized migration key to steal
///      ~$2M in bonding-curve liquidity that was mid-transit to Raydium.
///      There is no equivalent key here: nothing capable of moving curve
///      funds exists outside this contract's own permissionless logic.
///      See SECURITY.md for the full writeup.
contract BondingCurve is ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint256 public constant MAX_TOTAL_FEE_BPS = 500; // 5% hard ceiling, enforced at construction
    address public constant BURN_ADDRESS = 0x000000000000000000000000000000000000dEaD;

    // ---- Immutable launch parameters (set once, at construction) ----------
    address public immutable token;
    address public immutable creator;
    address public immutable factory;
    uint256 public immutable curveSupply;
    uint256 public immutable virtualQuoteReserve;
    uint256 public immutable k;
    /// @dev Compared against `realQuoteReserve`, which accumulates NET of
    ///      the protocol+creator fee — NOT gross msg.value ever sent in. A
    ///      curve with a 1.5% combined fee needs slightly more than
    ///      `graduationThreshold` in total buy volume to actually graduate.
    ///      Operators tuning this in LaunchFactory.setCurveDefaults should
    ///      read it as "real capital that ends up seeding the DEX pool",
    ///      not "total dollars ever spent on this token".
    uint256 public immutable graduationThreshold;
    uint256 public immutable protocolFeeBps;
    uint256 public immutable creatorFeeBps;

    /// @notice Creator's cut accrues here on every trade instead of being
    ///         pushed immediately, claimed on the creator's own schedule
    ///         via claimCreatorFees(). Protocol fees still go straight to
    ///         treasury on every trade, unchanged.
    uint256 public pendingCreatorFees;

    event CreatorFeesClaimed(address indexed creator, uint256 amount);
    address public immutable treasury;
    uint256 public immutable launchWindowEnd;
    uint256 public immutable maxBuyPerWalletDuringWindow;

    // ---- Mutable state ------------------------------------------------------
    uint256 public tokensSold;
    uint256 public realQuoteReserve;
    bool public graduated;
    bool public graduationExecuted;
    mapping(address => uint256) public boughtDuringWindow;

    event Buy(address indexed buyer, address indexed recipient, uint256 quoteIn, uint256 tokensOut, uint256 fee);
    event Sell(address indexed seller, address indexed recipient, uint256 tokensIn, uint256 quoteOut, uint256 fee);
    event GraduationTriggered(uint256 finalQuoteReserve, uint256 finalTokenReserve);
    event GraduationExecuted(address indexed router, uint256 quoteAdded, uint256 tokensAdded);
    event GraduationExecutionFailed(address indexed router);

    modifier whenNotGraduated() {
        require(!graduated, "Parabola: graduated");
        _;
    }

    constructor(
        address token_,
        address creator_,
        address factory_,
        uint256 curveSupply_,
        uint256 virtualQuoteReserve_,
        uint256 graduationThreshold_,
        uint256 protocolFeeBps_,
        uint256 creatorFeeBps_,
        address treasury_,
        uint256 launchWindowSeconds_,
        uint256 maxBuyPerWalletDuringWindow_
    ) {
        require(
            token_ != address(0) && creator_ != address(0) && factory_ != address(0) && treasury_ != address(0),
            "Parabola: zero addr"
        );
        require(curveSupply_ > 0, "Parabola: zero supply");
        require(virtualQuoteReserve_ > 0, "Parabola: zero virtual reserve");
        require(graduationThreshold_ > 0, "Parabola: zero threshold");
        require(protocolFeeBps_ + creatorFeeBps_ <= MAX_TOTAL_FEE_BPS, "Parabola: fee too high");

        token = token_;
        creator = creator_;
        factory = factory_;
        curveSupply = curveSupply_;
        virtualQuoteReserve = virtualQuoteReserve_;
        k = virtualQuoteReserve_ * curveSupply_;
        graduationThreshold = graduationThreshold_;
        protocolFeeBps = protocolFeeBps_;
        creatorFeeBps = creatorFeeBps_;
        treasury = treasury_;
        launchWindowEnd = block.timestamp + launchWindowSeconds_;
        maxBuyPerWalletDuringWindow = maxBuyPerWalletDuringWindow_;
    }

    // -------------------------------------------------------------------
    // Trading
    // -------------------------------------------------------------------

    /// @notice Buy tokens with native currency (USDC on Arc). Reverts if the
    ///         curve has already graduated — trade on the DEX pool instead.
    function buy(address recipient, uint256 minTokensOut)
        external
        payable
        nonReentrant
        whenNotGraduated
        returns (uint256 tokensOut)
    {
        require(msg.value > 0, "Parabola: zero amount");
        require(recipient != address(0), "Parabola: zero recipient");

        if (block.timestamp < launchWindowEnd) {
            uint256 already = boughtDuringWindow[recipient];
            require(already + msg.value <= maxBuyPerWalletDuringWindow, "Parabola: launch window cap");
            boughtDuringWindow[recipient] = already + msg.value;
        }

        uint256 protocolCut = (msg.value * protocolFeeBps) / BPS_DENOMINATOR;
        uint256 creatorCut = (msg.value * creatorFeeBps) / BPS_DENOMINATOR;
        uint256 netIn = msg.value - protocolCut - creatorCut;

        uint256 x = virtualQuoteReserve + realQuoteReserve;
        uint256 y = curveSupply - tokensSold;
        tokensOut = BondingCurveMath.getTokensOut(x, y, k, netIn);
        require(tokensOut >= minTokensOut, "Parabola: slippage");
        require(tokensOut > 0 && tokensOut <= y, "Parabola: bad output");

        // Effects before interactions.
        tokensSold += tokensOut;
        realQuoteReserve += netIn;

        emit Buy(msg.sender, recipient, msg.value, tokensOut, protocolCut + creatorCut);

        // Effects before interactions, including the fee accrual, not just
        // tokensSold/realQuoteReserve.
        pendingCreatorFees += creatorCut;

        IERC20(token).safeTransfer(recipient, tokensOut);
        _send(treasury, protocolCut);

        if (!graduated && realQuoteReserve >= graduationThreshold) {
            graduated = true;
            emit GraduationTriggered(realQuoteReserve, curveSupply - tokensSold);
            _attemptGraduationExecution();
        }
    }

    /// @notice Sell tokens back into the curve for native currency. Only
    ///         possible for tokens that were bought through this same curve
    ///         (i.e. tokenAmountIn can never exceed tokensSold), which is
    ///         also what guarantees the curve never owes out more real
    ///         currency than it actually holds.
    function sell(uint256 tokenAmountIn, uint256 minQuoteOut, address recipient)
        external
        nonReentrant
        whenNotGraduated
        returns (uint256 netOut)
    {
        require(tokenAmountIn > 0 && tokenAmountIn <= tokensSold, "Parabola: bad amount");
        require(recipient != address(0), "Parabola: zero recipient");

        uint256 x = virtualQuoteReserve + realQuoteReserve;
        uint256 y = curveSupply - tokensSold;
        uint256 grossOut = BondingCurveMath.getQuoteOut(x, y, k, tokenAmountIn);

        uint256 protocolCut = (grossOut * protocolFeeBps) / BPS_DENOMINATOR;
        uint256 creatorCut = (grossOut * creatorFeeBps) / BPS_DENOMINATOR;
        netOut = grossOut - protocolCut - creatorCut;
        require(netOut >= minQuoteOut, "Parabola: slippage");

        // Effects before interactions.
        tokensSold -= tokenAmountIn;
        realQuoteReserve -= grossOut;

        emit Sell(msg.sender, recipient, tokenAmountIn, netOut, protocolCut + creatorCut);

        // Effects before interactions, including the fee accrual.
        pendingCreatorFees += creatorCut;

        IERC20(token).safeTransferFrom(msg.sender, address(this), tokenAmountIn);
        _send(recipient, netOut);
        _send(treasury, protocolCut);
    }

    // -------------------------------------------------------------------
    // Graduation
    // -------------------------------------------------------------------

    /// @notice Permissionless retry for graduation execution. Anyone can
    ///         call this — no owner, no keeper role required — once the
    ///         curve has crossed its threshold but the automatic attempt
    ///         inside buy() could not complete (most likely because the
    ///         factory's dexRouter wasn't configured yet at the time).
    function executeGraduation() external nonReentrant {
        require(graduated, "Parabola: not graduated yet");
        require(!graduationExecuted, "Parabola: already executed");
        address router = IParabolaFactory(factory).dexRouter();
        require(router != address(0), "Parabola: router not configured");
        _doGraduate(router);
    }

    function _attemptGraduationExecution() internal {
        // Deliberately NOT `nonReentrant` — it only ever runs from inside
        // buy(), which already holds this contract's reentrancy lock for
        // the whole call. A second `nonReentrant` here would revert every
        // single buy that crosses the graduation threshold.
        address router = IParabolaFactory(factory).dexRouter();
        if (router == address(0)) return; // uncofigured — retry later via executeGraduation()
        _doGraduate(router);
    }

    function _doGraduate(address router) internal {
        if (graduationExecuted) return;
        graduationExecuted = true; // effects before interactions, even here

        uint256 finalQuote = realQuoteReserve;
        uint256 finalTokens = curveSupply - tokensSold;
        realQuoteReserve = 0;

        IERC20(token).forceApprove(router, finalTokens);

        try IDexRouter(router).addLiquidityETH{value: finalQuote}(
            token, finalTokens, 0, 0, address(this), block.timestamp + 900
        ) returns (uint256, uint256, uint256) {
            _burnLiquidity(router);
            emit GraduationExecuted(router, finalQuote, finalTokens);
        } catch {
            // Router misconfigured, incompatible, or reverted. The value
            // transfer inside addLiquidityETH reverts atomically along with
            // everything else in the failed call, so the native currency
            // never actually left this contract — restore the accounting
            // to match reality so executeGraduation() can be retried later.
            graduationExecuted = false;
            realQuoteReserve = finalQuote;
            IERC20(token).forceApprove(router, 0);
            emit GraduationExecutionFailed(router);
        }
    }

    function _burnLiquidity(address router) internal {
        address dexFactoryAddr = IParabolaFactory(factory).dexFactory();
        if (dexFactoryAddr == address(0)) return;
        address pair = IDexFactory(dexFactoryAddr).getPair(token, IDexRouter(router).WETH());
        if (pair == address(0)) return;
        uint256 lpBalance = IERC20(pair).balanceOf(address(this));
        if (lpBalance > 0) {
            IERC20(pair).safeTransfer(BURN_ADDRESS, lpBalance);
        }
    }

    function _send(address to, uint256 amount) internal {
        if (amount == 0) return;
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "Parabola: transfer failed");
    }

    /// @notice Sends the creator every fee they've accrued so far, on
    ///         their own schedule. Callable by anyone, but always pays out
    ///         to the fixed creator address, never the caller, so there's
    ///         no incentive or risk in someone else triggering it on the
    ///         creator's behalf (e.g. a bot that sweeps small balances).
    function claimCreatorFees() external nonReentrant {
        uint256 amount = pendingCreatorFees;
        require(amount > 0, "Parabola: nothing to claim");
        pendingCreatorFees = 0; // effects before interactions
        emit CreatorFeesClaimed(creator, amount);
        _send(creator, amount);
    }

    // -------------------------------------------------------------------
    // Views for the frontend
    // -------------------------------------------------------------------

    function quoteBuy(uint256 quoteIn) external view returns (uint256 tokensOut) {
        uint256 protocolCut = (quoteIn * protocolFeeBps) / BPS_DENOMINATOR;
        uint256 creatorCut = (quoteIn * creatorFeeBps) / BPS_DENOMINATOR;
        uint256 netIn = quoteIn - protocolCut - creatorCut;
        uint256 x = virtualQuoteReserve + realQuoteReserve;
        uint256 y = curveSupply - tokensSold;
        return BondingCurveMath.getTokensOut(x, y, k, netIn);
    }

    function quoteSell(uint256 tokenAmountIn) external view returns (uint256 netOut) {
        if (tokenAmountIn > tokensSold) return 0;
        uint256 x = virtualQuoteReserve + realQuoteReserve;
        uint256 y = curveSupply - tokensSold;
        uint256 grossOut = BondingCurveMath.getQuoteOut(x, y, k, tokenAmountIn);
        uint256 protocolCut = (grossOut * protocolFeeBps) / BPS_DENOMINATOR;
        uint256 creatorCut = (grossOut * creatorFeeBps) / BPS_DENOMINATOR;
        return grossOut - protocolCut - creatorCut;
    }

    /// @notice Current spot price, scaled by 1e36, in quote-currency smallest
    ///         units per whole token (1e18 raw token units). The large scale
    ///         factor matters: at realistic reserve sizes (USDC has 6
    ///         decimals, tokens have 18), a naive 1e18 scale truncates to a
    ///         single-digit integer that barely moves between trades — this
    ///         was caught by a test asserting price strictly increases after
    ///         a buy, which failed against the original 1e18-scaled version.
    ///         See SECURITY.md, finding SEC-3.
    function getCurrentPrice() external view returns (uint256) {
        uint256 x = virtualQuoteReserve + realQuoteReserve;
        uint256 y = curveSupply - tokensSold;
        if (y == 0) return 0;
        return Math.mulDiv(x, 1e36, y);
    }

    /// @notice Progress toward graduation, in basis points (10_000 = 100%).
    function progressBps() external view returns (uint256) {
        if (graduationThreshold == 0) return 0;
        uint256 bps = (realQuoteReserve * BPS_DENOMINATOR) / graduationThreshold;
        return bps > BPS_DENOMINATOR ? BPS_DENOMINATOR : bps;
    }

    /// @dev Direct sends are rejected — trade through buy() so slippage
    ///      protection and accounting stay correct. This also protects
    ///      users who might otherwise fat-finger a direct transfer to a
    ///      contract address and lose funds with no way to get them back.
    receive() external payable {
        revert("Parabola: use buy()");
    }
}
