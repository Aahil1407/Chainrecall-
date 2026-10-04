import QRCode from "qrcode";

async function main() {
  const batchId = process.env.BATCH_ID;

  if (!batchId) {
    console.error("BATCH_ID is required.");
    process.exit(1);
  }

  const verificationUrl =
    `http://localhost:5173/verify?batchId=${encodeURIComponent(batchId)}`;

  const fileName = `qr-${batchId}.png`;

  await QRCode.toFile(
    fileName,
    verificationUrl,
    {
      width: 500,
      margin: 2,
    }
  );

  console.log("QR code generated successfully!");
  console.log("Batch ID:", batchId);
  console.log("Verification URL:", verificationUrl);
  console.log("QR file:", fileName);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});