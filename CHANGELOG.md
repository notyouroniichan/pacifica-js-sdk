# Changelog

All notable changes to this project will be documented in this file.

## [1.1.0] - 2026-03-01

### Added
- **Production Grade Architecture**:
    - Introduced typed `PacificaError`, `AuthenticationError`, `NetworkError`, and `ValidationError` classes.
    - Added runtime validation for `privateKey` and `agentWallet` formats.
- **Testing Infrastructure**:
    - Added Jest configuration and unit tests for utilities.
    - Added ESLint and Prettier for code quality.
- **Robustness**:
    - Improved error handling in WebSocket messages.
    - Added timeouts to WebSocket requests.

### Changed
- Refactored `PacificaClient` to use the new error classes.
- Updated `package.json` with production metadata (repository, bugs, homepage).
- Moved `agent_wallet` logic to be more explicit in `signAndPrepareRequest`.
- Updated documentation to reflect community maintenance status.

### Fixed
- Fixed potential unhandled promise rejections in WebSocket connection logic.
