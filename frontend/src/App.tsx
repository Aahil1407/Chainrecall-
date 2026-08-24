import { useState } from "react";
import { getProduct } from "./blockchain";
import "./App.css";

function App() {
  const [batchId, setBatchId] = useState("");
  const [product, setProduct] = useState<any>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleVerify() {
    if (!batchId.trim()) {
      setError("Please enter a Batch ID.");
      return;
    }

    setLoading(true);
    setError("");
    setProduct(null);

    try {
      const result = await getProduct(batchId.trim());

      if (result[0] === "") {
        setError("Product not found on the blockchain.");
        return;
      }

      setProduct(result);
    } catch (err) {
      console.error(err);
      setError("Unable to connect to the blockchain.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app">
      <header className="navbar">
        <div className="logo">
          <span className="logo-mark">CR</span>
          <span>ChainRecall</span>
        </div>

        <div className="nav-status">
          <span className="status-dot"></span>
          Blockchain Connected
        </div>
      </header>

      <main className="main-content">
        <section className="hero">
          <p className="eyebrow">
            BLOCKCHAIN-BASED PRODUCT VERIFICATION
          </p>

          <h1>
            Verify before
            <br />
            <span>you trust.</span>
          </h1>

          <p className="subtitle">
            Instantly verify pharmaceutical products using their
            blockchain-registered batch information.
          </p>

          <div className="verify-card">
            <div className="card-header">
              <h2>Verify a Product</h2>
              <p>
                Enter the Batch ID found on the product packaging.
              </p>
            </div>

            <div className="input-row">
              <input
                type="text"
                value={batchId}
                onChange={(e) => setBatchId(e.target.value)}
                placeholder="e.g. CR-20260821-8474"
              />

              <button onClick={handleVerify} disabled={loading}>
                {loading ? "Verifying..." : "Verify Product"}
              </button>
            </div>

            <button className="scan-button">
              ◉ &nbsp; Scan QR Code
            </button>

            {error && <div className="error-message">{error}</div>}

            {product && (
              <div className="result-card">
                <div className="result-header">
                  <div>
                    <p className="result-label">VERIFIED PRODUCT</p>
                    <h2>{product[1]}</h2>
                  </div>

                  <div
                    className={
                      product[5]
                        ? "status-badge recalled"
                        : "status-badge valid"
                    }
                  >
                    {product[5] ? "🚨 RECALLED" : "✓ VALID"}
                  </div>
                </div>

                <div className="product-details">
                  <div>
                    <span>Batch ID</span>
                    <strong>{product[0]}</strong>
                  </div>

                  <div>
                    <span>Manufacturer</span>
                    <strong>{product[2]}</strong>
                  </div>

                  <div>
                    <span>Manufacture Date</span>
                    <strong>{product[3].toString()}</strong>
                  </div>

                  <div>
                    <span>Expiry Date</span>
                    <strong>{product[4].toString()}</strong>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="features">
          <div className="feature">
            <div className="feature-icon">⌁</div>
            <h3>Blockchain Verified</h3>
            <p>
              Product records are registered and verified directly
              against the blockchain.
            </p>
          </div>

          <div className="feature">
            <div className="feature-icon">✓</div>
            <h3>Authenticity Check</h3>
            <p>
              Confirm the product's batch information and manufacturer
              details.
            </p>
          </div>

          <div className="feature">
            <div className="feature-icon">!</div>
            <h3>Recall Detection</h3>
            <p>
              Instantly identify products that have been flagged for
              recall.
            </p>
          </div>
        </section>
      </main>

      <footer>
        <p>ChainRecall · Pharmaceutical Product Verification</p>
        <p>Powered by Blockchain</p>
      </footer>
    </div>
  );
}

export default App;