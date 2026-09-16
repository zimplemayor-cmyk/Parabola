// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {VestingWallet} from "@openzeppelin/contracts/finance/VestingWallet.sol";
import {LaunchToken} from "./LaunchToken.sol";
import {BondingCurve} from "./BondingCurve.sol";

/// @title LaunchFactory
/// @notice Entry point for creating Parabola launches. Deliberately holds
///         only *platform configuration* — fee rates, the treasury address,
///         the DEX router to graduate into, sane parameter bounds. It is
///         never able to touch a single launch's raised funds, tokens, or
///         vested allocation. See SECURITY.md → "What the owner can and
///         cannot do" for the exact, enumerated list.
contract LaunchFactory is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ---- Fixed platform-wide constants -------------------------------------
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 ether; // 1B tokens, 18 decimals, every launch
    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint256 public constant MAX_TOTAL_FEE_BPS = 500; // 5% hard ceiling (mirrors BondingCurve's own check)
    uint256 public constant MAX_TEAM_BPS = 2_000; // 20% hard ceiling — NOT owner-adjustable, ever
    uint256 public constant MIN_VESTING_DURATION = 90 days;
    uint256 public constant MAX_LAUNCH_WINDOW = 1 days;
    uint256 public constant MIN_VIRTUAL_QUOTE_RESERVE = 100e18; // 100 USDC-equivalent, 18-decimal native accounting
    uint256 public constant MAX_VIRTUAL_QUOTE_RESERVE = 1_000_000e18;
    uint256 public constant MIN_GRADUATION_THRESHOLD = 1_000e18; // 1,000 USDC-equivalent
    uint256 public constant MAX_GRADUATION_THRESHOLD = 10_000_000e18;
    uint256 public constant MAX_NAME_LEN = 32;
    uint256 public constant MAX_SYMBOL_LEN = 12;
    uint256 public constant MAX_METADATA_URI_LEN = 256;

    // ---- Mutable platform configuration (owner-adjustable, within bounds) --
    address public treasury;
    address public dexRouter; // read dynamically by every BondingCurve at graduation time
    address public dexFactory;
    uint256 public protocolFeeBps;
    uint256 public creatorFeeBps;
    uint256 public defaultVirtualQuoteReserve;
    uint256 public defaultGraduationThreshold;
    uint256 public launchWindowSeconds;
    uint256 public maxBuyPerWalletDuringWindow;
    bool public paused;

    struct Launch {
        address token;
        address curve;
        address creator;
        address vestingWallet; // address(0) for meme launches
        uint64 createdAt;
        bool isBuilderLaunch;
        string metadataURI;
    }

    Launch[] public allLaunches;
    /// @dev O(1) reverse lookup so the frontend can go straight from a
    ///      token address (what's in the URL/wallet) to its curve, instead
    ///      of scanning allLaunches — matters once there are more than a
    ///      handful of launches.
    mapping(address => address) public curveForToken;

    event LaunchCreated(
        address indexed token,
        address indexed curve,
        address indexed creator,
        address vestingWallet,
        bool isBuilderLaunch,
        string metadataURI
    );
    event TreasuryUpdated(address treasury);
    event DexConfigUpdated(address dexRouter, address dexFactory);
    event FeesUpdated(uint256 protocolFeeBps, uint256 creatorFeeBps);
    event CurveDefaultsUpdated(
        uint256 virtualQuoteReserve,
        uint256 graduationThreshold,
        uint256 launchWindowSeconds,
        uint256 maxBuyPerWalletDuringWindow
    );
    event PausedUpdated(bool paused);

    modifier whenNotPaused() {
        require(!paused, "Parabola: launches paused");
        _;
    }

    constructor(address initialOwner, address treasury_) Ownable(initialOwner) {
        require(treasury_ != address(0), "Parabola: zero treasury");
        treasury = treasury_;
        protocolFeeBps = 100; // 1%
        creatorFeeBps = 50; // 0.5%
        defaultVirtualQuoteReserve = 3_000e18; // 3,000 USDC-equivalent virtual depth, 18-decimal native accounting
        defaultGraduationThreshold = 30_000e18; // 30,000 USDC-equivalent raised
        launchWindowSeconds = 600; // 10 minutes
        maxBuyPerWalletDuringWindow = 500e18; // 500 USDC-equivalent per wallet during the window
    }

    // -------------------------------------------------------------------
    // Launch creation
    // -------------------------------------------------------------------

    /// @notice Fair-launch track: 100% of supply goes to the bonding curve,
    ///         zero team allocation. creatorFeeBps_ is the creator's own
    ///         chosen cut of every trade (e.g. 100 = 1%), capped so that,
    ///         combined with the platform's protocolFeeBps, the total never
    ///         exceeds MAX_TOTAL_FEE_BPS, the same 5% ceiling setFees
    ///         enforces for the factory-wide default. If msg.value > 0, the
    ///         creator's first buy executes atomically in this same
    ///         transaction, before the launch is even visible to anyone
    ///         else, so a creator never has to race snipers for their own
    ///         token.
    function createMemeLaunch(
        string calldata name,
        string calldata symbol,
        string calldata metadataURI,
        uint256 creatorFeeBps_,
        uint256 minTokensOut
    ) external payable whenNotPaused nonReentrant returns (address tokenAddr, address curveAddr) {
        _validateMetadata(name, symbol, metadataURI);
        require(protocolFeeBps + creatorFeeBps_ <= MAX_TOTAL_FEE_BPS, "Parabola: fee too high");

        LaunchToken newToken = new LaunchToken(name, symbol, TOTAL_SUPPLY, address(this));
        BondingCurve curve = new BondingCurve(
            address(newToken),
            msg.sender,
            address(this),
            TOTAL_SUPPLY,
            defaultVirtualQuoteReserve,
            defaultGraduationThreshold,
            protocolFeeBps,
            creatorFeeBps_,
            treasury,
            launchWindowSeconds,
            maxBuyPerWalletDuringWindow
        );
        IERC20(address(newToken)).safeTransfer(address(curve), TOTAL_SUPPLY);

        tokenAddr = address(newToken);
        curveAddr = address(curve);
        _registerLaunch(tokenAddr, curveAddr, msg.sender, address(0), false, metadataURI);

        if (msg.value > 0) {
            curve.buy{value: msg.value}(msg.sender, minTokensOut);
        }
    }

    /// @notice Builder track: up to MAX_TEAM_BPS of supply is carved out to
    ///         a linear-vesting OpenZeppelin VestingWallet owned by the
    ///         creator; the remainder funds the public bonding curve.
    ///         creatorFeeBps_ works the same way as in createMemeLaunch.
    ///         The vesting wallet only ever releases tokens on a schedule
    ///         that was fixed at creation, nobody, including Parabola, can
    ///         accelerate, pause, or revoke it.
    function createBuilderLaunch(
        string calldata name,
        string calldata symbol,
        string calldata metadataURI,
        uint256 teamBps,
        uint256 vestingDurationSeconds,
        uint256 creatorFeeBps_,
        uint256 minTokensOut
    )
        external
        payable
        whenNotPaused
        nonReentrant
        returns (address tokenAddr, address curveAddr, address vestingAddr)
    {
        _validateMetadata(name, symbol, metadataURI);
        require(teamBps <= MAX_TEAM_BPS, "Parabola: team allocation too high");
        require(vestingDurationSeconds >= MIN_VESTING_DURATION, "Parabola: vesting too short");
        require(protocolFeeBps + creatorFeeBps_ <= MAX_TOTAL_FEE_BPS, "Parabola: fee too high");

        uint256 teamAmount = (TOTAL_SUPPLY * teamBps) / BPS_DENOMINATOR;
        uint256 curveAmount = TOTAL_SUPPLY - teamAmount;

        LaunchToken newToken = new LaunchToken(name, symbol, TOTAL_SUPPLY, address(this));

        if (teamAmount > 0) {
            VestingWallet vesting = new VestingWallet(
                msg.sender,
                uint64(block.timestamp),
                uint64(vestingDurationSeconds)
            );
            vestingAddr = address(vesting);
            IERC20(address(newToken)).safeTransfer(vestingAddr, teamAmount);
        }

        BondingCurve curve = new BondingCurve(
            address(newToken),
            msg.sender,
            address(this),
            curveAmount,
            defaultVirtualQuoteReserve,
            defaultGraduationThreshold,
            protocolFeeBps,
            creatorFeeBps_,
            treasury,
            launchWindowSeconds,
            maxBuyPerWalletDuringWindow
        );
        IERC20(address(newToken)).safeTransfer(address(curve), curveAmount);

        tokenAddr = address(newToken);
        curveAddr = address(curve);
        _registerLaunch(tokenAddr, curveAddr, msg.sender, vestingAddr, true, metadataURI);

        if (msg.value > 0) {
            curve.buy{value: msg.value}(msg.sender, minTokensOut);
        }
    }

    function _validateMetadata(string calldata name, string calldata symbol, string calldata metadataURI)
        internal
        pure
    {
        require(bytes(name).length > 0 && bytes(name).length <= MAX_NAME_LEN, "Parabola: bad name length");
        require(bytes(symbol).length > 0 && bytes(symbol).length <= MAX_SYMBOL_LEN, "Parabola: bad symbol length");
        require(bytes(metadataURI).length <= MAX_METADATA_URI_LEN, "Parabola: metadata URI too long");
    }

    function _registerLaunch(
        address tokenAddr,
        address curveAddr,
        address creator_,
        address vestingAddr,
        bool isBuilder,
        string calldata metadataURI
    ) internal {
        allLaunches.push(
            Launch({
                token: tokenAddr,
                curve: curveAddr,
                creator: creator_,
                vestingWallet: vestingAddr,
                createdAt: uint64(block.timestamp),
                isBuilderLaunch: isBuilder,
                metadataURI: metadataURI
            })
        );
        curveForToken[tokenAddr] = curveAddr;
        emit LaunchCreated(tokenAddr, curveAddr, creator_, vestingAddr, isBuilder, metadataURI);
    }

    // -------------------------------------------------------------------
    // Registry views (no backend/indexer required for MVP scale)
    // -------------------------------------------------------------------

    function totalLaunches() external view returns (uint256) {
        return allLaunches.length;
    }

    function getLaunches(uint256 offset, uint256 limit) external view returns (Launch[] memory page) {
        uint256 total = allLaunches.length;
        if (offset >= total) return new Launch[](0);
        uint256 end = offset + limit;
        if (end > total) end = total;
        uint256 size = end - offset;
        page = new Launch[](size);
        for (uint256 i = 0; i < size; i++) {
            page[i] = allLaunches[offset + i];
        }
    }

    // -------------------------------------------------------------------
    // Owner configuration — see SECURITY.md for the exact powers this is
    // (and, just as importantly, is NOT) able to exercise.
    // -------------------------------------------------------------------

    function setTreasury(address treasury_) external onlyOwner {
        require(treasury_ != address(0), "Parabola: zero treasury");
        treasury = treasury_;
        emit TreasuryUpdated(treasury_);
    }

    function setDexConfig(address dexRouter_, address dexFactory_) external onlyOwner {
        dexRouter = dexRouter_;
        dexFactory = dexFactory_;
        emit DexConfigUpdated(dexRouter_, dexFactory_);
    }

    function setFees(uint256 protocolFeeBps_, uint256 creatorFeeBps_) external onlyOwner {
        require(protocolFeeBps_ + creatorFeeBps_ <= MAX_TOTAL_FEE_BPS, "Parabola: fee too high");
        protocolFeeBps = protocolFeeBps_;
        creatorFeeBps = creatorFeeBps_;
        emit FeesUpdated(protocolFeeBps_, creatorFeeBps_);
    }

    function setCurveDefaults(
        uint256 virtualQuoteReserve_,
        uint256 graduationThreshold_,
        uint256 launchWindowSeconds_,
        uint256 maxBuyPerWalletDuringWindow_
    ) external onlyOwner {
        require(
            virtualQuoteReserve_ >= MIN_VIRTUAL_QUOTE_RESERVE && virtualQuoteReserve_ <= MAX_VIRTUAL_QUOTE_RESERVE,
            "Parabola: virtual reserve out of bounds"
        );
        require(
            graduationThreshold_ >= MIN_GRADUATION_THRESHOLD && graduationThreshold_ <= MAX_GRADUATION_THRESHOLD,
            "Parabola: graduation threshold out of bounds"
        );
        require(launchWindowSeconds_ <= MAX_LAUNCH_WINDOW, "Parabola: launch window too long");
        require(
            launchWindowSeconds_ == 0 || maxBuyPerWalletDuringWindow_ > 0,
            "Parabola: zero cap with nonzero window"
        );

        defaultVirtualQuoteReserve = virtualQuoteReserve_;
        defaultGraduationThreshold = graduationThreshold_;
        launchWindowSeconds = launchWindowSeconds_;
        maxBuyPerWalletDuringWindow = maxBuyPerWalletDuringWindow_;
        emit CurveDefaultsUpdated(
            virtualQuoteReserve_,
            graduationThreshold_,
            launchWindowSeconds_,
            maxBuyPerWalletDuringWindow_
        );
    }

    /// @dev Only ever blocks NEW launches. Deliberately has no effect on any
    ///      already-deployed BondingCurve's buy/sell/graduation — the owner
    ///      cannot freeze trading on a live launch, only stop new ones from
    ///      being created (e.g. if a bug is found in this factory itself).
    function setPaused(bool paused_) external onlyOwner {
        paused = paused_;
        emit PausedUpdated(paused_);
    }
}
