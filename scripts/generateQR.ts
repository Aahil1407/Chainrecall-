import QRCode from "qrcode";

async function main() {
  const batchId = process.env.BATCH_ID;

  if (!batchId) {
    console.error("BATCH_ID is required.");
    process.exit(1);
  }

  const fileName = `qr-${batchId}.png`;

  await QRCode.toFile(fileName, batchId, {
    width: 500,
    margin: 2,
  });

  console.log("QR code generated successfully!");
  console.log("Batch ID:", batchId);
  console.log("QR file:", fileName);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});