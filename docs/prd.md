PRD.md — AppSwap Project
1. Overview

AppSwap is a cross-rollup decentralized exchange (DEX) built on the Initia chain ecosystem.
The platform allows users to swap tokens across rollups with minimal friction, leveraging the Interwoven bridging layer, automated pool routing, and Initia-native tooling.

Key Goals:

Cross-rollup token swaps
Fully automated backend development via Claude
Frontend with shitty-gradient, professional-looking UI (no mockups, placeholders, or todos)
Audit-ready smart contracts and deployment scripts
Hackathon-ready submission artifacts
2. Claude’s Role

Claude is not a documentation-only AI—he is the autonomous developer for AppSwap. He performs:

Environment setup: Installs Weave, Minitiad, Foundry, Node, Go, Docker; runs weave init, opinit executor, relayer init
Rollup validation: Continuously checks RPC endpoints, executor health, gas accounts, IBC channels
Smart contract dev: AMM pools, Router.sol, FeeDistributor.sol, PoolRegistry.sol, bridge adapters, and security/fuzz tests
Frontend dev: React + Next.js, shitty-gradient UI, InterwovenKit integration, wallet flows, swap UX, state management
Deployment: Forge scripts, ABIs for frontend, bridge channel setup, CI pipelines
Security audits: Reentrancy, overflow, oracle risk, cross-rollup race conditions, arbitrage surface
Hackathon support: Pitch decks, diagrams, PDFs, demo video scripts

Claude is end-to-end responsible for everything from dev to deployment.

3. Tech Stack
Backend: Solidity (EVM), Foundry for testing, TypeScript for scripts
Frontend: React + Next.js, React Query, Zustand for state, shitty-gradient UI
Blockchain: Initia appchains, Minitiad nodes, Weave CLI, OPinit executor
Cross-chain: Interwoven + IBC bridging
DevOps: Docker, Node.js, Go, GitHub Actions, CI pipelines
4. Features
4.1 Core DEX Features
Token swap (single-rollup and cross-rollup)
Multi-rollup pool routing
Slippage calculation & error boundaries
Fee calculation & distribution
Event logging & analytics hooks
4.2 Bridge Layer
Interwoven + IBC integration
Escrow-based atomic swaps
Cross-rollup callback handlers
Bridge channel health monitoring
4.3 Frontend Features
Wallet auto-connect & session management
Username resolution (.init)
Token selection & quote requests
Real-time swap execution feedback
Slippage & gas warnings
UI: shitty-gradient professional look, no mock/placeholder/todo
4.4 DevOps & Deployment
Forge deploy scripts
Rollup contract deployment with ABIs
Gas station account automation
CI/CD pipelines
Rollup restart & monitoring scripts
4.5 Security
Reentrancy checks
Fee overflow detection
Oracle manipulation risk analysis
Cross-rollup race condition prevention
AMM arbitrage surface mitigation
5. UX/UI Guidelines
Framework: React + Next.js
Styling: Shitty-gradient look, professional, no flashy gradients or placeholders
No mockups or todo indicators
Real components wired to live state
Wallet & swap flows: fully functional
State management: multi-rollup token balances, reactive EVM providers
6. Testing
Unit tests for AMM math & pool operations
Fuzz tests for swap functions
State machine tests for cross-rollup operations
Gas profiling & performance analysis
7. Hackathon Submission
Architecture diagram PDF
Value proposition slides
Technical execution documentation
Demo video script
Deployable code bundle

Claude automates all of this, ensuring the project is fully functional, deployable, and hackathon-ready.

8. Summary

AppSwap is not just a DEX. It is an Initia-native, cross-rollup, fully automated system built with:

Claude: autonomous developer & deployment agent
Shitty-gradient professional UI: real React components, no mocks
Full cross-rollup integration
Automated testing & deployment pipelines

End users experience a smooth swap interface; developers experience fully automated contract, frontend, and DevOps execution.