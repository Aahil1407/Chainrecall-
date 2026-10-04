const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");
const { ethers } = require("ethers");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const app = express();

const FRONTEND_ORIGIN = "http://localhost:5173";
const AUTH_COOKIE_NAME = "chainrecall_auth";
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;
const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
};

app.use(cors({ origin: FRONTEND_ORIGIN, credentials: true }));
app.use(express.json());

// =========================================
// CONFIGURATION
// =========================================

const PORT = 5000;

const CONTRACT_ADDRESS =
  process.env.CONTRACT_ADDRESS;

const RPC_URL =
  process.env.BLOCKCHAIN_RPC_URL ||
  "http://127.0.0.1:8545";

const PRIVATE_KEY =
  process.env.BLOCKCHAIN_PRIVATE_KEY;

const JWT_SECRET = process.env.JWT_SECRET;

// =========================================
// BLOCKCHAIN ABI
// =========================================

const CONTRACT_ABI = [
  "function registerProduct(string,string,string,uint256,uint256)",
  "function updateRecallStatus(string,bool)",
  "function getProduct(string) view returns (tuple(string batchId,string productName,string manufacturer,uint256 manufactureDate,uint256 expiryDate,bool recalled))",
];

// =========================================
// BLOCKCHAIN CONNECTION
// =========================================

const provider = new ethers.JsonRpcProvider(
  RPC_URL
);

const wallet = new ethers.Wallet(
  PRIVATE_KEY,
  provider
);

const chainRecall = new ethers.Contract(
  CONTRACT_ADDRESS,
  CONTRACT_ABI,
  wallet
);

// =========================================
// MYSQL CONNECTION
// =========================================

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || "chainrecall",
  port: Number(process.env.DB_PORT || 3306),

  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// =========================================
// GENERATE BATCH ID
// =========================================

function generateBatchId() {
  const date = new Date();

  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    date.getDate()
  ).padStart(2, "0");

  const randomNumber = Math.floor(
    1000 + Math.random() * 9000
  );

  return `CR-${year}${month}${day}-${randomNumber}`;
}

// =========================================
// HEALTH CHECK
// =========================================

app.get("/", (req, res) => {
  res.json({
    message: "ChainRecall backend is running",
  });
});

// =========================================
// MANUFACTURER AUTHENTICATION
// =========================================

app.post("/api/auth/login", requireTrustedOrigin, async (req, res) => {
  const email = typeof req.body.email === "string"
    ? req.body.email.trim().toLowerCase()
    : "";
  const password = typeof req.body.password === "string"
    ? req.body.password
    : "";

  if (!email || !password) {
    return res.status(401).json({ message: "Invalid email or password" });
  }

  try {
    const [rows] = await pool.execute(
      `
      SELECT user_id, manufacturer_name, email, password_hash, role, is_active
      FROM manufacturer_accounts
      WHERE email = ?
      LIMIT 1
      `,
      [email]
    );

    const account = rows[0];
    const passwordMatches = account
      ? await bcrypt.compare(password, account.password_hash)
      : false;

    if (!account || !Boolean(account.is_active) || !passwordMatches) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const token = jwt.sign(
      {
        userId: account.user_id,
        role: account.role,
        manufacturer: account.manufacturer_name,
      },
      JWT_SECRET,
      { expiresIn: "8h" }
    );

    res.cookie(AUTH_COOKIE_NAME, token, {
      ...AUTH_COOKIE_OPTIONS,
      maxAge: SESSION_DURATION_MS,
    });

    return res.json({
      message: "Login successful",
      user: {
        userId: account.user_id,
        email: account.email,
        manufacturer: account.manufacturer_name,
        role: account.role,
      },
    });
  } catch (error) {
    console.error("Authentication failed:", error.code || error.message);
    return res.status(500).json({ message: "Authentication service unavailable" });
  }
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

app.post("/api/auth/logout", requireTrustedOrigin, (req, res) => {
  res.clearCookie(AUTH_COOKIE_NAME, AUTH_COOKIE_OPTIONS);
  res.json({ message: "Logged out" });
});

// =========================================
// REGISTER PRODUCT
// =========================================

app.post(
  "/api/products/register",
  requireAuth,
  requireRole("MANUFACTURER"),
  requireTrustedOrigin,
  async (req, res) => {

    try {

      const {
        productName,
        manufactureDate,
        expiryDate,
      } = req.body;
      const manufacturer = req.user.manufacturer;

      if (
        req.body.manufacturer !== undefined &&
        req.body.manufacturer !== manufacturer
      ) {
        return res.status(403).json({
          message: "Manufacturer identity does not match the authenticated account.",
        });
      }

      // =====================================
      // VALIDATE INPUT
      // =====================================

      if (
        !productName ||
        !manufacturer ||
        !manufactureDate ||
        !expiryDate
      ) {
        return res.status(400).json({
          message:
            "Product name, manufacturer, manufacture date and expiry date are required.",
        });
      }

      if (expiryDate <= manufactureDate) {
        return res.status(400).json({
          message:
            "Expiry date must be after manufacture date.",
        });
      }

      // =====================================
      // GENERATE BATCH ID
      // =====================================

      const batchId = generateBatchId();

      console.log(
        "\n========================================"
      );

      console.log(
        "REGISTERING NEW PRODUCT"
      );

      console.log(
        "Batch ID:",
        batchId
      );

      // =====================================
      // CONVERT DATES TO BLOCKCHAIN FORMAT
      // =====================================

      const manufactureTimestamp =
        Math.floor(
          new Date(
            manufactureDate
          ).getTime() / 1000
        );

      const expiryTimestamp =
        Math.floor(
          new Date(
            expiryDate
          ).getTime() / 1000
        );

      // =====================================
      // REGISTER ON BLOCKCHAIN
      // =====================================

      const tx =
        await chainRecall.registerProduct(
          batchId,
          productName,
          manufacturer,
          manufactureTimestamp,
          expiryTimestamp
        );

      console.log(
        "Transaction submitted:",
        tx.hash
      );

      await tx.wait();

      console.log(
        "Blockchain transaction confirmed."
      );

      // =====================================
      // SAVE TO MYSQL
      // =====================================

      const [result] =
        await pool.execute(
          `
          INSERT INTO products (
            batch_id,
            product_name,
            manufacturer,
            manufacturer_user_id,
            manufacture_date,
            expiry_date,
            contract_address,
            registration_tx_hash,
            recalled
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, FALSE)
          `,
          [
            batchId,
            productName,
            manufacturer,
            req.user.userId,
            manufactureDate,
            expiryDate,
            CONTRACT_ADDRESS,
            tx.hash,
          ]
        );

      console.log(
        "Product saved to MySQL."
      );

      console.log(
        "========================================\n"
      );

      // =====================================
      // RESPONSE
      // =====================================

      res.status(201).json({

        message:
          "Product registered successfully",

        productId:
          result.insertId,

        batchId,

        productName,

        manufacturer,

        manufactureDate,

        expiryDate,

        transactionHash:
          tx.hash,

        contractAddress:
          CONTRACT_ADDRESS,
      });

    } catch (error) {

      console.error(
        "Product registration failed:",
        error
      );

      res.status(500).json({

        message:
          "Product registration failed",

        error:
          error.message,
      });
    }
  }
);

// =========================================
// GET ALL PRODUCTS
// =========================================

app.get(
  "/api/products",
  requireAuth,
  requireRole("ADMIN", "MANUFACTURER"),
  async (req, res) => {
  try {
    const isManufacturer = req.user.role === "MANUFACTURER";
    const productScope = isManufacturer
      ? "WHERE p.manufacturer_user_id = ?"
      : "";
    const scopeParams = isManufacturer ? [req.user.userId] : [];

    const [rows] = await pool.execute(
      `
      SELECT
        p.product_id,
        p.batch_id,
        p.product_name,
        p.manufacturer,
        p.manufacture_date,
        p.expiry_date,
        p.recalled,
        p.contract_address,
        p.registration_tx_hash,
        p.recall_tx_hash,
        p.recalled_at,
        COALESCE(v.verification_count, 0) AS verification_count,
        COALESCE(v.recalled_verification_count, 0) AS recalled_verification_count,
        v.last_verified_at
      FROM products p
      LEFT JOIN (
        SELECT
          batch_id,
          COUNT(*) AS verification_count,
          SUM(verification_result = 'RECALLED') AS recalled_verification_count,
          MAX(verified_at) AS last_verified_at
        FROM verification_logs
        GROUP BY batch_id
      ) v ON v.batch_id = p.batch_id
      ${productScope}
      ORDER BY p.product_id DESC
      `,
      scopeParams
    );

    // Recall status on the chain is authoritative; MySQL remains its reporting mirror.
    const products = await Promise.all(rows.map(async (row) => {
      const onChainProduct = await chainRecall.getProduct(row.batch_id);
      const recalled = Boolean(onChainProduct.batchId) && onChainProduct.recalled;

      if (Boolean(row.recalled) !== recalled) {
        await pool.execute(
          "UPDATE products SET recalled = ? WHERE batch_id = ?",
          [recalled, row.batch_id]
        );
      }

      return { ...row, recalled };
    }));

    const analyticsJoin = isManufacturer
      ? "JOIN products p ON p.batch_id = verification_logs.batch_id WHERE p.manufacturer_user_id = ?"
      : "";
    const [[analytics]] = await pool.execute(
      `
      SELECT
        COUNT(*) AS total_verifications,
        COALESCE(SUM(verification_result = 'RECALLED'), 0) AS recalled_product_verifications
      FROM verification_logs
      ${analyticsJoin}
      `,
      scopeParams
    );

    res.json({
      products,
      total: products.length,
      analytics: {
        totalVerifications: Number(analytics.total_verifications),
        recalledProductVerifications: Number(analytics.recalled_product_verifications),
      },
    });

  } catch (error) {
    console.error(
      "Failed to fetch products:",
      error
    );

    res.status(500).json({
      message: "Failed to fetch products",
      error: error.message,
    });
  }
  }
);

function parseCookies(req) {
  const header = req.headers.cookie || "";
  const cookies = {};

  for (const item of header.split(";")) {
    const separator = item.indexOf("=");
    if (separator < 0) continue;
    const name = item.slice(0, separator).trim();
    const value = item.slice(separator + 1).trim();
    try {
      cookies[name] = decodeURIComponent(value);
    } catch {
      cookies[name] = "";
    }
  }

  return cookies;
}

async function requireAuth(req, res, next) {
  const token = parseCookies(req)[AUTH_COOKIE_NAME];
  if (!token) {
    return res.status(401).json({ message: "Authentication required" });
  }

  let claims;
  try {
    claims = jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(401).json({ message: "Invalid or expired authentication" });
  }

  if (!Number.isInteger(claims.userId)) {
    return res.status(401).json({ message: "Invalid authentication" });
  }

  try {
    const [rows] = await pool.execute(
      `
      SELECT user_id, manufacturer_name, email, role, is_active
      FROM manufacturer_accounts
      WHERE user_id = ?
      LIMIT 1
      `,
      [claims.userId]
    );

    if (rows.length === 0 || !Boolean(rows[0].is_active)) {
      return res.status(401).json({ message: "Authentication required" });
    }

    req.user = {
      userId: rows[0].user_id,
      email: rows[0].email,
      manufacturer: rows[0].manufacturer_name,
      role: rows[0].role,
    };
    return next();
  } catch (error) {
    console.error("Session lookup failed:", error.code || error.message);
    return res.status(503).json({ message: "Authentication service unavailable" });
  }
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    return next();
  };
}

function requireTrustedOrigin(req, res, next) {
  if (req.get("origin") !== FRONTEND_ORIGIN) {
    return res.status(403).json({ message: "Untrusted request origin" });
  }
  return next();
}

async function ensureAuthSchema() {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS manufacturer_accounts (
      user_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      manufacturer_name VARCHAR(150) NOT NULL,
      email VARCHAR(190) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      role ENUM('ADMIN', 'MANUFACTURER') NOT NULL DEFAULT 'MANUFACTURER',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      INDEX idx_manufacturer_accounts_name (manufacturer_name)
    ) ENGINE=InnoDB
  `);

  const [productColumns] = await pool.execute("SHOW COLUMNS FROM products");
  const columnNames = new Set(productColumns.map((column) => column.Field));
  if (!columnNames.has("manufacturer_user_id")) {
    await pool.execute(
      "ALTER TABLE products ADD COLUMN manufacturer_user_id INT NULL AFTER manufacturer"
    );
  }

  const [productIndexes] = await pool.execute("SHOW INDEX FROM products");
  if (!productIndexes.some((index) => index.Key_name === "idx_products_manufacturer_user_id")) {
    await pool.execute(
      "ALTER TABLE products ADD INDEX idx_products_manufacturer_user_id (manufacturer_user_id)"
    );
  }

  const [foreignKeys] = await pool.execute(
    `
    SELECT CONSTRAINT_NAME
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'products'
      AND COLUMN_NAME = 'manufacturer_user_id'
      AND REFERENCED_TABLE_NAME = 'manufacturer_accounts'
    `
  );
  if (foreignKeys.length === 0) {
    await pool.execute(`
      ALTER TABLE products
      ADD CONSTRAINT fk_products_manufacturer_account
      FOREIGN KEY (manufacturer_user_id)
      REFERENCES manufacturer_accounts (user_id)
      ON DELETE SET NULL
      ON UPDATE CASCADE
    `);
  }
}

// =========================================
// PRODUCT AUDIT HISTORY
// =========================================

app.get(
  "/api/products/:batchId/history",
  async (req, res) => {
    const { batchId } = req.params;

    try {
      const [productRows] = await pool.execute(
        `
        SELECT
          product_id,
          batch_id,
          product_name,
          manufacturer,
          manufacture_date,
          expiry_date,
          contract_address,
          registration_tx_hash,
          created_at,
          recall_tx_hash,
          recalled_at
        FROM products
        WHERE batch_id = ?
        `,
        [batchId]
      );

      if (productRows.length === 0) {
        return res.status(404).json({ message: "Product not found" });
      }

      const product = productRows[0];
      const [verificationRows] = await pool.execute(
        `
        SELECT verification_id, batch_id, verification_result, verified_at
        FROM verification_logs
        WHERE batch_id = ?
        ORDER BY verified_at ASC, verification_id ASC
        `,
        [batchId]
      );

      const onChainProduct = await chainRecall.getProduct(batchId);
      const currentStatus = onChainProduct.batchId
        ? (onChainProduct.recalled ? "RECALLED" : "VALID")
        : "NOT_FOUND";

      const events = [];

      if (product.created_at || product.registration_tx_hash) {
        events.push({
          id: `registration-${product.product_id}`,
          type: "registration",
          occurredAt: product.created_at,
          transactionHash: product.registration_tx_hash,
          description: "Registration record saved after blockchain confirmation",
        });
      }

      for (const verification of verificationRows) {
        events.push({
          id: `verification-${verification.verification_id}`,
          type: "verification",
          occurredAt: verification.verified_at,
          result: verification.verification_result,
        });
      }

      if (product.recall_tx_hash || product.recalled_at) {
        events.push({
          id: `recall-${product.product_id}`,
          type: "recall",
          occurredAt: product.recalled_at,
          transactionHash: product.recall_tx_hash,
          description: "Blockchain recall transaction confirmed",
        });
      }

      events.sort((a, b) => {
        if (!a.occurredAt) return 1;
        if (!b.occurredAt) return -1;
        return new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime();
      });

      res.json({
        product: {
          ...product,
          recalled: currentStatus === "RECALLED",
          currentStatus,
        },
        events,
      });
    } catch (error) {
      console.error("Product history lookup failed:", error);
      res.status(500).json({
        message: "Product history lookup failed",
        error: error.message,
      });
    }
  }
);

// =========================================
// GET PRODUCT FROM MYSQL
// =========================================

app.get(
  "/api/products/:batchId",
  requireAuth,
  requireRole("ADMIN", "MANUFACTURER"),
  async (req, res) => {

    try {

      const { batchId } =
        req.params;

      const [rows] =
        await pool.execute(
          `
          SELECT *
          FROM products
          WHERE batch_id = ?
          `,
          [batchId]
        );

      if (rows.length === 0) {

        return res.status(404).json({
          message:
            "Product not found",
        });

      }

      if (
        req.user.role === "MANUFACTURER" &&
        Number(rows[0].manufacturer_user_id) !== Number(req.user.userId)
      ) {
        return res.status(403).json({ message: "Forbidden" });
      }

      res.json(rows[0]);

    } catch (error) {

      console.error(
        "Database lookup failed:",
        error
      );

      res.status(500).json({
        message:
          "Database lookup failed",
        error:
          error.message,
      });
    }
  }
);

// =========================================
// VERIFY PRODUCT
// =========================================

app.get(
  "/api/products/:batchId/verify",
  async (req, res) => {

    const { batchId } =
      req.params;

    try {

      // =====================================
      // GET PRODUCT FROM BLOCKCHAIN
      // =====================================

      const product =
        await chainRecall.getProduct(
          batchId
        );

      if (!product.batchId) {

        return res.status(404).json({

          message:
            "Product not found on blockchain",

          verificationResult:
            "NOT_FOUND",
        });
      }

      // =====================================
      // GET PRODUCT FROM MYSQL
      // =====================================

      const [rows] =
        await pool.execute(
          `
          SELECT
            product_id,
            batch_id,
            product_name,
            manufacturer,
            manufacture_date,
            expiry_date
          FROM products
          WHERE batch_id = ?
          `,
          [batchId]
        );

      if (rows.length === 0) {

        return res.status(404).json({

          message:
            "Product exists on blockchain but not in database",

          verificationResult:
            "NOT_FOUND",
        });
      }

      const databaseProduct =
        rows[0];

      // =====================================
      // BLOCKCHAIN IS AUTHORITATIVE
      // =====================================

      const recalled =
        product.recalled;

      const verificationResult =
        recalled
          ? "RECALLED"
          : "VALID";

      // =====================================
      // LOG VERIFICATION
      // =====================================

      await pool.execute(
        `
        INSERT INTO verification_logs (
          batch_id,
          verification_result
        )
        VALUES (?, ?)
        `,
        [
          batchId,
          verificationResult,
        ]
      );

      // =====================================
      // RESPONSE
      // =====================================

      res.json({

        verified: true,

        verificationResult,

        product: {

          batchId:
            product.batchId,

          productName:
            product.productName,

          manufacturer:
            product.manufacturer,

          manufactureDate:
            databaseProduct.manufacture_date,

          expiryDate:
            databaseProduct.expiry_date,

          recalled,
        },

        blockchain: {

          contractAddress:
            CONTRACT_ADDRESS,
        },
      });

    } catch (error) {

      console.error(
        "Verification failed:",
        error
      );

      res.status(500).json({

        message:
          "Product verification failed",

        error:
          error.message,
      });
    }
  }
);

// =========================================
// RECALL PRODUCT
// =========================================

app.post(
  "/api/products/:batchId/recall",
  requireAuth,
  requireRole("ADMIN", "MANUFACTURER"),
  requireTrustedOrigin,
  async (req, res) => {

    const { batchId } =
      req.params;

    try {

      if (req.user.role === "MANUFACTURER") {
        const [ownedProducts] = await pool.execute(
          "SELECT manufacturer_user_id FROM products WHERE batch_id = ? LIMIT 1",
          [batchId]
        );

        if (
          ownedProducts.length === 0 ||
          Number(ownedProducts[0].manufacturer_user_id) !== Number(req.user.userId)
        ) {
          return res.status(403).json({ message: "Forbidden" });
        }
      }

      console.log(
        "\n========================================"
      );

      console.log(
        "RECALL REQUEST"
      );

      console.log(
        "Batch ID:",
        batchId
      );

      // =====================================
      // CHECK PRODUCT ON BLOCKCHAIN
      // =====================================

      const product =
        await chainRecall.getProduct(
          batchId
        );

      if (!product.batchId) {

        return res.status(404).json({

          message:
            "Product not found on blockchain",
        });
      }

      // =====================================
      // CHECK IF ALREADY RECALLED
      // =====================================

      if (product.recalled) {

  // Blockchain is the source of truth.
  // Synchronize MySQL if it is still out of date.

  await pool.execute(
    `
    UPDATE products
    SET recalled = TRUE
    WHERE batch_id = ?
    `,
    [batchId]
  );

  const [storedProducts] = await pool.execute(
    "SELECT recall_tx_hash FROM products WHERE batch_id = ?",
    [batchId]
  );

  return res.json({

    message:
      "Product is already recalled. Database synchronized.",

    batchId,

    recalled: true,

    transactionHash:
      storedProducts[0]?.recall_tx_hash || null,

    contractAddress:
      CONTRACT_ADDRESS,
  });
}

      // =====================================
      // UPDATE BLOCKCHAIN
      // =====================================

      console.log(
        "Submitting recall transaction..."
      );

      const tx =
        await chainRecall.updateRecallStatus(
          batchId,
          true
        );

      console.log(
        "Transaction submitted:",
        tx.hash
      );

      await tx.wait();

      console.log(
        "Recall transaction confirmed."
      );

      // =====================================
      // UPDATE MYSQL
      // =====================================

      await pool.execute(
        `
        UPDATE products
        SET recalled = TRUE,
            recall_tx_hash = ?,
            recalled_at = NOW()
        WHERE batch_id = ?
        `,
        [tx.hash, batchId]
      );

      console.log(
        "MySQL recall status updated."
      );

      console.log(
        "========================================\n"
      );

      // =====================================
      // RESPONSE
      // =====================================

      res.json({

        message:
          "Product recalled successfully",

        batchId,

        recalled: true,

        transactionHash:
          tx.hash,

        contractAddress:
          CONTRACT_ADDRESS,
      });

    } catch (error) {

      console.error(
        "Recall failed:",
        error
      );

      res.status(500).json({

        message:
          "Product recall failed",

        error:
          error.message,
      });
    }
  }
);

// =========================================
// START SERVER
// =========================================

async function startServer() {

  try {

    if (!JWT_SECRET || Buffer.byteLength(JWT_SECRET) < 32) {
      throw new Error("JWT_SECRET must be configured with at least 32 bytes.");
    }

    await ensureAuthSchema();

    // Add audit metadata columns when upgrading an existing database.
    const [auditColumns] = await pool.execute(
      `
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'products'
        AND COLUMN_NAME IN ('recall_tx_hash', 'recalled_at')
      `
    );
    const existingAuditColumns = new Set(
      auditColumns.map((column) => column.COLUMN_NAME)
    );

    if (!existingAuditColumns.has("recall_tx_hash")) {
      await pool.execute(
        "ALTER TABLE products ADD COLUMN recall_tx_hash VARCHAR(100) NULL"
      );
    }

    if (!existingAuditColumns.has("recalled_at")) {
      await pool.execute(
        "ALTER TABLE products ADD COLUMN recalled_at TIMESTAMP NULL DEFAULT NULL"
      );
    }

    // =====================================
    // TEST MYSQL CONNECTION
    // =====================================

    await pool.query(
      "SELECT 1"
    );

    console.log(
      "✅ MySQL connected successfully"
    );

    // =====================================
    // TEST BLOCKCHAIN CONNECTION
    // =====================================

    const network =
      await provider.getNetwork();

    console.log(
      "Blockchain network:",
      network.chainId.toString()
    );

    console.log(
      "Blockchain wallet:",
      wallet.address
    );

    console.log(
      "Contract address:",
      CONTRACT_ADDRESS
    );

    // =====================================
    // START EXPRESS
    // =====================================

    app.listen(
      PORT,
      () => {

        console.log(
          `🚀 ChainRecall backend running on port ${PORT}`
        );

      }
    );

  } catch (error) {

    console.error(
      "❌ Server startup failed:",
      error
    );

    process.exit(1);
  }
}

startServer();
