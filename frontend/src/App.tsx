import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import "./App.css";

type Product = {
  batchId: string;
  productName: string;
  manufacturer: string;
  manufactureDate: string;
  expiryDate: string;
  recalled: boolean;
};

function App() {
  const [batchId, setBatchId] = useState("");
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);

  const scannerRef =
    useRef<Html5Qrcode | null>(null);

  const BACKEND_URL =
    "http://localhost:5000";

  // =========================================
  // VERIFY PRODUCT
  // =========================================

  async function verifyProduct(id: string) {
    const value = id.trim();

    if (!value) {
      setError("Invalid Batch ID.");
      return;
    }

    setLoading(true);
    setError("");
    setProduct(null);

    try {
      const response = await fetch(
        `${BACKEND_URL}/api/products/${encodeURIComponent(
          value
        )}/verify`
      );

      const data = await response.json();

      if (!response.ok) {
        setError(
          data.message ||
            "Product verification failed."
        );
        return;
      }

      if (!data.verified) {
        setError(
          "Product could not be verified."
        );
        return;
      }

      setProduct(data.product);

    } catch (err) {
      console.error(err);

      setError(
        "Unable to connect to the ChainRecall backend."
      );

    } finally {
      setLoading(false);
    }
  }

  // =========================================
  // EXTRACT BATCH ID FROM QR
  // =========================================

  function extractBatchId(
    decodedText: string
  ): string | null {

    try {

      // QR contains a URL
      if (
        decodedText.startsWith("http://") ||
        decodedText.startsWith("https://")
      ) {

        const url =
          new URL(decodedText);

        const id =
          url.searchParams.get(
            "batchId"
          );

        return id;
      }

      // Also support old QR codes
      // containing only the Batch ID

      if (
        decodedText.startsWith("CR-")
      ) {
        return decodedText;
      }

      return null;

    } catch {
      return null;
    }
  }

  // =========================================
  // START CAMERA SCANNER
  // =========================================

  async function startScanner() {

    setError("");
    setProduct(null);
    setScanning(true);

    // Give React time to render qr-reader
    setTimeout(async () => {

      try {

        const scanner =
          new Html5Qrcode(
            "qr-reader"
          );

        scannerRef.current =
          scanner;

        await scanner.start(

          {
            facingMode:
              "environment",
          },

          {
            fps: 10,

            qrbox: {
              width: 250,
              height: 250,
            },
          },

          async (
            decodedText
          ) => {

            console.log(
              "QR detected:",
              decodedText
            );

            const extractedBatchId =
              extractBatchId(
                decodedText
              );

            if (
              !extractedBatchId
            ) {

              setError(
                "Invalid ChainRecall QR code."
              );

              return;
            }

            // Stop camera
            try {

              await scanner.stop();

              scanner.clear();

            } catch (err) {

              console.error(
                "Scanner cleanup error:",
                err
              );

            }

            scannerRef.current =
              null;

            setScanning(false);

            // Put Batch ID into input
            setBatchId(
              extractedBatchId
            );

            // Verify automatically
            await verifyProduct(
              extractedBatchId
            );
          },

          () => {
            // Ignore continuous
            // scan failures
          }
        );

      } catch (err) {

        console.error(
          "Camera error:",
          err
        );

        setScanning(false);

        setError(
          "Unable to access the camera. Please allow camera permission and try again."
        );
      }

    }, 100);
  }

  // =========================================
  // STOP SCANNER
  // =========================================

  async function stopScanner() {

    try {

      if (
        scannerRef.current
      ) {

        await scannerRef.current.stop();

        scannerRef.current.clear();

        scannerRef.current =
          null;
      }

    } catch (err) {

      console.error(
        "Scanner stop error:",
        err
      );

    }

    setScanning(false);
  }

  // =========================================
  // CLEANUP WHEN PAGE CLOSES
  // =========================================

  useEffect(() => {

    return () => {

      if (
        scannerRef.current
      ) {

        scannerRef.current
          .stop()
          .catch(() => {});

      }

    };

  }, []);

  // =========================================
  // AUTOMATIC QR URL VERIFICATION
  // =========================================

  useEffect(() => {

    const params =
      new URLSearchParams(
        window.location.search
      );

    const qrBatchId =
      params.get("batchId");

    if (qrBatchId) {

      setBatchId(
        qrBatchId
      );

      verifyProduct(
        qrBatchId
      );
    }

  }, []);

  // =========================================
  // MANUAL VERIFY
  // =========================================

  function handleVerify() {

    verifyProduct(
      batchId
    );
  }

  // =========================================
  // UI
  // =========================================

  return (

    <div className="app">

      {/* NAVBAR */}

      <header className="navbar">

        <div className="logo">

          <span className="logo-mark">
            CR
          </span>

          <span>
            ChainRecall
          </span>

        </div>

        <nav className="nav-actions" aria-label="Main navigation">
          <a className="nav-button active" href="/" aria-current="page">
            Verify Product
          </a>
          <a className="nav-button" href="/manufacturer">
            Manufacturer Portal
          </a>
        </nav>

        <div className="nav-status">

          <span className="status-dot"></span>

          Blockchain Connected

        </div>

      </header>

      {/* MAIN */}

      <main className="main-content">

        <section className="hero">

          <p className="eyebrow">
            BLOCKCHAIN-BASED PRODUCT VERIFICATION
          </p>

          <h1>

            Verify before
            <br />

            <span>
              you trust.
            </span>

          </h1>

          <p className="subtitle">

            Verify pharmaceutical products
            using blockchain-registered
            batch information.

          </p>

          {/* VERIFY CARD */}

          <div className="verify-card">

            <div className="card-header">

              <h2>
                Verify a Product
              </h2>

              <p>
                Scan a product QR code or
                enter its Batch ID.
              </p>

            </div>

            {/* INPUT */}

            <div className="input-row">

              <input
                type="text"
                value={batchId}
                onChange={(e) =>
                  setBatchId(
                    e.target.value
                  )
                }
                placeholder="e.g. CR-20261004-1747"
              />

              <button
                onClick={
                  handleVerify
                }
                disabled={loading}
              >

                {loading
                  ? "Verifying..."
                  : "Verify Product"}

              </button>

            </div>

            {/* SCANNER */}

            {!scanning && (

              <button
                className="scan-button"
                onClick={
                  startScanner
                }
              >

                ◉ &nbsp; Scan QR Code

              </button>

            )}

            {scanning && (

              <div className="scanner-container">

                <div id="qr-reader"></div>

                <button
                  className="scan-button"
                  onClick={
                    stopScanner
                  }
                >

                  ✕ &nbsp; Stop Scanner

                </button>

              </div>

            )}

            {/* QR LINK */}

            {new URLSearchParams(
              window.location.search
            ).get("batchId") && (

              <div className="qr-detected">

                ✓ QR verification link detected

              </div>

            )}

            {/* ERROR */}

            {error && (

              <div className="error-message">

                {error}

              </div>

            )}

            {/* LOADING */}

            {loading && (

              <div className="loading-message">

                Checking blockchain...

              </div>

            )}

            {/* RESULT */}

            {product &&
              !loading && (

                <div className="result-card">

                  <div className="result-header">

                    <div>

                      <p className="result-label">

                        VERIFIED PRODUCT

                      </p>

                      <h2>

                        {
                          product.productName
                        }

                      </h2>

                    </div>

                    <div
                      className={
                        product.recalled
                          ? "status-badge recalled"
                          : "status-badge valid"
                      }
                    >

                      {product.recalled
                        ? "🚨 RECALLED"
                        : "✓ VALID"}

                    </div>

                  </div>

                  <div className="product-details">

                    <div>

                      <span>
                        Batch ID
                      </span>

                      <strong>
                        {
                          product.batchId
                        }
                      </strong>

                    </div>

                    <div>

                      <span>
                        Manufacturer
                      </span>

                      <strong>
                        {
                          product.manufacturer
                        }
                      </strong>

                    </div>

                    <div>

                      <span>
                        Manufacture Date
                      </span>

                      <strong>
                        {
                          product.manufactureDate
                        }
                      </strong>

                    </div>

                    <div>

                      <span>
                        Expiry Date
                      </span>

                      <strong>
                        {
                          product.expiryDate
                        }
                      </strong>

                    </div>

                  </div>

                </div>

              )}

          </div>

        </section>

        {/* FEATURES */}

        <section className="features">

          <div className="feature">

            <div className="feature-icon">
              ⛓
            </div>

            <h3>
              Blockchain Verified
            </h3>

            <p>
              Product records are verified
              directly against the blockchain.
            </p>

          </div>

          <div className="feature">

            <div className="feature-icon">
              ✓
            </div>

            <h3>
              Authenticity Check
            </h3>

            <p>
              Confirm batch information and
              manufacturer details.
            </p>

          </div>

          <div className="feature">

            <div className="feature-icon">
              !
            </div>

            <h3>
              Recall Detection
            </h3>

            <p>
              Instantly identify products that
              have been recalled.
            </p>

          </div>

        </section>

      </main>

      <footer>

        <p>
          ChainRecall · Pharmaceutical Product Verification
        </p>

        <p>
          Powered by Blockchain
        </p>

      </footer>

    </div>
  );
}

export default App;
