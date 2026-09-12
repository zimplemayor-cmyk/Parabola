// Hardhat's own compiler downloader needs binaries.soliditylang.org, which
// is not reachable from this sandbox's network allowlist. This script
// compiles the exact same sources with the npm-published `solc` package
// (the official solc-js WASM build, installed normally via the npm
// registry) and writes artifacts in Hardhat's own on-disk format, so
// `hardhat test --no-compile` can pick them up and run real tests against
// a real compiled bytecode on Hardhat's local in-process EVM.
const fs = require("fs");
const path = require("path");
const solc = require("solc");

const ROOT = path.resolve(__dirname, "..");
const CONTRACTS_DIR = path.join(ROOT, "contracts");
const ARTIFACTS_DIR = path.join(ROOT, "artifacts");

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith(".sol")) out.push(full);
  }
  return out;
}

const sourceFiles = walk(CONTRACTS_DIR);
const sources = {};
for (const file of sourceFiles) {
  const rel = "contracts/" + path.relative(CONTRACTS_DIR, file).split(path.sep).join("/");
  sources[rel] = { content: fs.readFileSync(file, "utf8") };
}

function findImports(importPath) {
  try {
    let resolved;
    if (importPath.startsWith("@openzeppelin/")) {
      resolved = path.join(ROOT, "node_modules", importPath);
    } else {
      // relative import from within contracts/ — importPath already includes
      // e.g. "./libraries/BondingCurveMath.sol"; solc gives us paths relative
      // to the importing file OR relative to the source root depending on
      // how it was written. We already store everything under "contracts/",
      // so resolve relative-looking imports against that root as a fallback.
      resolved = path.join(CONTRACTS_DIR, importPath.replace(/^\.\//, "").replace(/^contracts\//, ""));
    }
    return { contents: fs.readFileSync(resolved, "utf8") };
  } catch (e) {
    return { error: "File not found: " + importPath };
  }
}

const input = {
  language: "Solidity",
  sources,
  settings: {
    optimizer: { enabled: true, runs: 200 },
    viaIR: true,
    outputSelection: {
      "*": { "*": ["abi", "evm.bytecode.object", "evm.deployedBytecode.object", "evm.bytecode.linkReferences", "evm.deployedBytecode.linkReferences"] },
    },
  },
};

console.log(`Compiling ${sourceFiles.length} source files with solc ${solc.version()} ...`);
const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));

let hasError = false;
for (const diag of output.errors || []) {
  const line = `[${diag.severity}] ${diag.formattedMessage}`;
  if (diag.severity === "error") {
    hasError = true;
    console.error(line);
  } else {
    console.warn(line);
  }
}

if (hasError) {
  console.error("\nCompilation FAILED — see errors above.");
  process.exit(1);
}

let written = 0;
for (const [sourceName, fileOutput] of Object.entries(output.contracts || {})) {
  for (const [contractName, contractOutput] of Object.entries(fileOutput)) {
    const bytecode = contractOutput.evm?.bytecode?.object || "";
    if (!bytecode) continue; // interfaces/abstract contracts — nothing to deploy
    const artifact = {
      _format: "hh-sol-artifact-1",
      contractName,
      sourceName,
      abi: contractOutput.abi,
      bytecode: "0x" + bytecode,
      deployedBytecode: "0x" + (contractOutput.evm?.deployedBytecode?.object || ""),
      linkReferences: contractOutput.evm?.bytecode?.linkReferences || {},
      deployedLinkReferences: contractOutput.evm?.deployedBytecode?.linkReferences || {},
    };
    const outDir = path.join(ARTIFACTS_DIR, sourceName);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, `${contractName}.json`), JSON.stringify(artifact, null, 2));
    written++;
  }
}

console.log(`Wrote ${written} artifacts to ${path.relative(ROOT, ARTIFACTS_DIR)}/`);
