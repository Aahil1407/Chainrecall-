# ChainRecall deployment guide

## Readiness and current requirements

The app can be deployed without replacing its architecture. It has a React/Vite frontend, Express API, MySQL data store, and an owner-authorized Solidity contract. The frontend calls the API; it does not need a signing key. The backend signs product registration and recall transactions, so its signing key must stay in the backend host's secret settings.

The API expects an existing MySQL `products` table and `verification_logs` table. Startup creates `manufacturer_accounts`, adds `products.manufacturer_user_id` and its index/foreign key, and adds `recall_tx_hash` and `recalled_at` if missing. These are additive changes, but startup currently performs them automatically. Take a database backup and confirm these tables/columns and permissions before first start. There is no checked-in base SQL migration, and this guide does not reconstruct one from assumptions.

Environment variable names (values belong only in the hosting provider's secret settings):

- Backend: `NODE_ENV`, `PORT`, `FRONTEND_ORIGIN`, `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `BLOCKCHAIN_RPC_URL`, `BLOCKCHAIN_PRIVATE_KEY`, `CONTRACT_ADDRESS`, `JWT_SECRET`.
- Optional seed command: `SEED_ABC_EMAIL`, `SEED_ABC_PASSWORD`, `SEED_PFIZER_EMAIL`, `SEED_PFIZER_PASSWORD`.
- Frontend build: `VITE_API_BASE_URL` (public API URL; never put secrets or private keys in `VITE_*`).
- Sepolia contract deployment: `SEPOLIA_RPC_URL`, `SEPOLIA_PRIVATE_KEY` (local deployer environment only).

## 1. Prepare MySQL

Create a managed MySQL database and a dedicated application user with access limited to that database. Obtain the host, port, database name, username, and password from its provider. Choose a provider whose connection can be reached from the backend host. The migration tools are not installed in this workspace, so perform this step from a machine with the MySQL client tools or use the provider's managed import tool.

Before migrating, take a backup and inspect the source schema with `SHOW CREATE TABLE products;` and `SHOW CREATE TABLE verification_logs;`. Confirm both match the columns used by the API queries in `backend/server.js`. Export the existing database to a protected location outside the repository, then import it into a newly created, empty managed database. Never restore over a database that already contains data. Validate row counts and sample records before pointing the backend at it. This keeps existing products, verification logs, and accounts intact. Backend startup then creates `manufacturer_accounts` if absent and adds the account-linkage and audit columns to `products`; review and test those additive changes on a staging copy first. Allow the backend database user `CREATE`, `ALTER`, `INDEX`, and `REFERENCES` privileges for startup schema setup, or apply the same reviewed additive DDL with a migration operator before reducing privileges.

## 2. Deploy the contract to Sepolia

Use a new wallet funded only with Sepolia test ETH. Never use a mainnet key or a wallet holding real funds. The current Hardhat config reads `SEPOLIA_RPC_URL` and `SEPOLIA_PRIVATE_KEY` as process environment variables. A `.env` file is not automatically loaded by this root Hardhat project, so inject them through a local secret manager or the shell environment for this command; never commit a file containing them. Then run from the repository root:

```sh
npx hardhat ignition deploy ignition/modules/ChainRecall.ts --network sepolia
```

Record the printed contract address. The deploying account becomes the contract owner and must match the backend's `BLOCKCHAIN_PRIVATE_KEY`, because only the owner can register products or update recalls. Set `CONTRACT_ADDRESS` to the deployed Sepolia address and `BLOCKCHAIN_RPC_URL` to the Sepolia RPC endpoint in the backend service. Do not commit deployment output containing secrets; the contract address and transaction hash are public chain data.

## 3. Deploy the backend

Create a Node web service on Render (or another Node host), with `backend` as its root directory and `npm start` as its start command. Set `/health` as its health-check path. Set `NODE_ENV=production`, `PORT` as assigned by the host, `FRONTEND_ORIGIN` to the exact frontend origin (scheme and hostname, no path), and the database and blockchain variables above. Generate a unique random `JWT_SECRET` of at least 32 bytes. Store every password, secret, and private key in the provider's encrypted environment settings. Do not add secrets to the repo, build command, or logs.

Back up the target database before the initial service start. The backend uses `FRONTEND_ORIGIN` as the sole allowed CORS origin and checks the same origin on authenticated mutations. Credentialed wildcard CORS is not used. Production auth cookies are `HttpOnly`, `Secure`, and `SameSite=None` to permit cross-origin requests. Browsers may block third-party cookies when Vercel and Render use unrelated domains. For reliable manufacturer login, use custom frontend and API domains under the same registrable site (for example `app.example.com` and `api.example.com`), and configure the exact frontend origin on the backend. Keep HTTPS enabled on both.

If manufacturer accounts need to be initialized, first confirm which accounts should exist. The included `seed:manufacturers` script creates/updates two fixed manufacturer identities and links products by exact manufacturer labels. Do not run it against production until account ownership, passwords, and those labels have been reviewed. Set its four `SEED_*` variables in a protected one-off environment and run `npm run seed:manufacturers` from `backend`; it prints no password values.

## 4. Deploy the frontend to Vercel

Create a Vercel project rooted at `frontend` and use the Vite defaults (`npm run build`, output `dist`). Set `VITE_API_BASE_URL` to the backend's HTTPS origin, without an API path. The value is public and becomes part of the browser bundle. The included Vercel rewrite serves the SPA for `/verify` QR links. Configure the matching exact frontend origin as backend `FRONTEND_ORIGIN`; redeploy/restart the backend after changing it.

Generated QR codes use the currently loaded frontend origin, so local QR codes point to localhost and deployed QR codes point to the production frontend. QR scanners require HTTPS in production for camera access.

## 5. Verify the deployed workflow

1. Open `https://<backend-host>/health` and confirm it returns `{"status":"ok"}`.
2. Load the Vercel site and verify a known existing batch through the public consumer flow. Confirm the API reports the expected blockchain status and the Vercel request succeeds without a CORS error.
3. Sign in with an intentionally provisioned manufacturer account; reload the dashboard and confirm the session remains authenticated. Check logout clears the session.
4. Confirm inventory, analytics, and audit history load for that account.
5. Register a product only when you are ready to make a real testnet record; verify its QR opens the deployed `/verify` page and scans over HTTPS. A recall is a real Sepolia transaction and should only be exercised deliberately, never as a deployment smoke test.

## 6. Secrets and rollback

Keep `.env` files, wallet keys, database passwords, seed passwords, and JWT secrets out of Git and Vercel variables. Only `VITE_API_BASE_URL` belongs in the frontend build environment. If a secret was exposed, rotate it at the provider and update the backend configuration; removing it from a later commit is not sufficient.

For an application rollback, redeploy the previous frontend/backend build and restore the previous environment settings. For database rollback, stop writes, take a fresh backup, and restore from the pre-deployment backup if needed. Do not reverse startup's additive DDL by dropping columns or tables. Sepolia transactions and deployed contract state cannot be rolled back; redeploy a new test contract if the contract configuration is wrong, then update the backend address.
