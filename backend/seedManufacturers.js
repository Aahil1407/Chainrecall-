require("dotenv").config();

const bcrypt = require("bcryptjs");
const mysql = require("mysql2/promise");

const accounts = [
  {
    manufacturer: "ABC Pharma",
    email: process.env.SEED_ABC_EMAIL,
    password: process.env.SEED_ABC_PASSWORD,
  },
  {
    manufacturer: "Pfizer",
    email: process.env.SEED_PFIZER_EMAIL,
    password: process.env.SEED_PFIZER_PASSWORD,
  },
];

async function seed() {
  const normalizedEmails = accounts.map((account) =>
    typeof account.email === "string" ? account.email.trim().toLowerCase() : ""
  );

  if (
    normalizedEmails.some((email) => !email.includes("@")) ||
    new Set(normalizedEmails).size !== normalizedEmails.length
  ) {
    throw new Error("Provide two distinct valid seed email addresses.");
  }

  for (const account of accounts) {
    if (!account.email || !account.password || account.password.length < 12) {
      throw new Error(
        "Set SEED_ABC_EMAIL, SEED_ABC_PASSWORD, SEED_PFIZER_EMAIL, and SEED_PFIZER_PASSWORD. Passwords must be at least 12 characters."
      );
    }
  }

  const pool = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || "chainrecall",
    port: Number(process.env.DB_PORT || 3306),
    waitForConnections: true,
    connectionLimit: 2,
  });

  try {
    for (const account of accounts) {
      const email = account.email.trim().toLowerCase();
      const passwordHash = await bcrypt.hash(account.password, 12);
      await pool.execute(
        `
        INSERT INTO manufacturer_accounts (
          manufacturer_name,
          email,
          password_hash,
          role,
          is_active
        )
        VALUES (?, ?, ?, 'MANUFACTURER', TRUE)
        ON DUPLICATE KEY UPDATE
          manufacturer_name = VALUES(manufacturer_name),
          password_hash = VALUES(password_hash),
          role = 'MANUFACTURER',
          is_active = TRUE
        `,
        [account.manufacturer, email, passwordHash]
      );
    }

    // Link only exact existing manufacturer labels; never infer spelling aliases.
    for (const account of accounts) {
      const [rows] = await pool.execute(
        "SELECT user_id FROM manufacturer_accounts WHERE email = ? LIMIT 1",
        [account.email.trim().toLowerCase()]
      );
      await pool.execute(
        `
        UPDATE products
        SET manufacturer_user_id = ?
        WHERE manufacturer = ?
          AND manufacturer_user_id IS NULL
        `,
        [rows[0].user_id, account.manufacturer]
      );
    }

    const [unmapped] = await pool.execute(
      `
      SELECT manufacturer, COUNT(*) AS product_count
      FROM products
      WHERE manufacturer_user_id IS NULL
      GROUP BY manufacturer
      ORDER BY manufacturer
      `
    );

    console.log("Manufacturer accounts seeded; password values were not logged.");
    if (unmapped.length) {
      console.log(
        "Unmapped product manufacturer labels:",
        unmapped.map((row) => `${row.manufacturer} (${row.product_count})`).join(", ")
      );
    }
  } finally {
    await pool.end();
  }
}

seed().catch((error) => {
  console.error("Manufacturer account seeding failed:", error.code || error.message);
  process.exitCode = 1;
});
