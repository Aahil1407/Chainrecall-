import { useCallback, useEffect, useState, type FormEvent } from "react";
import QRCode from "qrcode";
import { API_URL, registerProduct, type RegisterProductRequest, type RegisterProductResponse } from "./api";
import "./Manufacturer.css";

type Product = {
  product_id: number;
  batch_id: string;
  product_name: string;
  manufacturer: string;
  manufacture_date: string;
  expiry_date: string;
  recalled: boolean | number | string | null;
  blockchainVerification?: { status: "VERIFIED" | "UNAVAILABLE"; reason?: string; message?: string };
  contract_address: string;
  registration_tx_hash: string;
  recall_tx_hash: string | null;
  recalled_at: string | null;
  verification_count: number | string;
  recalled_verification_count: number | string;
  last_verified_at: string | null;
};

type HistoryEvent = {
  id: string;
  type: "registration" | "verification" | "recall";
  occurredAt: string | null;
  transactionHash?: string | null;
  description?: string;
  result?: string;
};

type ProductHistory = {
  product: Product & { currentStatus: "VALID" | "RECALLED" | "NOT_FOUND" };
  events: HistoryEvent[];
};

type ProductListResponse = {
  products?: Product[];
  analytics?: {
    totalVerifications: number;
    recalledProductVerifications: number;
  };
};

type AuthUser = {
  userId: number;
  email: string;
  manufacturer: string | null;
  role: "ADMIN" | "MANUFACTURER";
};

function isRecalled(value: Product["recalled"]): boolean {
  return value === true || value === 1 || value === "1";
}

function formatDate(value: string): string {
  if (!value) return "—";
  const datePart = value.slice(0, 10);
  const date = new Date(`${datePart}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? datePart
    : date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
}

function formatDateTime(value: string | null): string {
  if (!value) return "Time not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
}

async function readError(response: Response): Promise<string> {
  try {
    const body = await response.json();
    return body.message || `Request failed (${response.status})`;
  } catch {
    return `Request failed (${response.status})`;
  }
}

function Manufacturer() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [activeView, setActiveView] = useState<"dashboard" | "register">("dashboard");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [recallingBatch, setRecallingBatch] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [history, setHistory] = useState<ProductHistory | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "VALID" | "RECALLED" | "UNVERIFIED">("ALL");
  const [analytics, setAnalytics] = useState({
    totalVerifications: 0,
    recalledProductVerifications: 0,
  });
  const [form, setForm] = useState<RegisterProductRequest>({
    productName: "",
    manufacturer: "",
    manufactureDate: "",
    expiryDate: "",
  });
  const [registrationError, setRegistrationError] = useState("");
  const [registering, setRegistering] = useState(false);
  const [registration, setRegistration] = useState<RegisterProductResponse | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [qrError, setQrError] = useState("");

  const loadProducts = useCallback(async (mode: "initial" | "refresh" = "refresh") => {
    if (mode === "initial") setLoading(true);
    else setRefreshing(true);
    setError("");

    try {
      const response = await fetch(`${API_URL}/api/products`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error(await readError(response));
      const data: ProductListResponse = await response.json();
      if (!Array.isArray(data.products)) {
        throw new Error("The product list response was not in the expected format.");
      }
      setProducts(data.products);
      if (data.analytics) setAnalytics(data.analytics);
      setSelectedProduct((current) =>
        current
          ? data.products?.find((product) => product.batch_id === current.batch_id) ?? null
          : null,
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load products. Please try again.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  async function checkSession() {
    setAuthLoading(true);
    setAuthError("");
    try {
      const response = await fetch(`${API_URL}/api/auth/me`, {
        credentials: "include",
      });
      if (response.status === 401) {
        window.location.replace("/login");
        return;
      }
      if (!response.ok) throw new Error(await readError(response));

      const result: { user: AuthUser } = await response.json();
      setUser(result.user);
      setForm((current) => ({
        ...current,
        manufacturer: result.user.manufacturer || "",
      }));
      await loadProducts("initial");
    } catch (requestError) {
      setAuthError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to check the manufacturer session.",
      );
    } finally {
      setAuthLoading(false);
    }
  }

  useEffect(() => {
    void checkSession();
  }, []);

  async function logout() {
    try {
      await fetch(`${API_URL}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } finally {
      setUser(null);
      window.location.assign("/login");
    }
  }

  async function recallProduct(product: Product) {
    if (product.blockchainVerification?.status === "UNAVAILABLE") {
      setError("This batch is not registered on the current blockchain. Reconcile the batch before initiating a recall.");
      return;
    }
    if (product.blockchainVerification?.status === "VERIFIED" && isRecalled(product.recalled)) return;
    const confirmed = window.confirm(
      `Recall ${product.product_name} (batch ${product.batch_id})? This action updates the product recall status.`,
    );
    if (!confirmed) return;

    setRecallingBatch(product.batch_id);
    setError("");
    try {
      const response = await fetch(
        `${API_URL}/api/products/${encodeURIComponent(product.batch_id)}/recall`,
        { method: "POST", credentials: "include" },
      );
      if (!response.ok) throw new Error(await readError(response));
      // Always read current state back from the backend, including when it was already recalled.
      await loadProducts("refresh");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to recall this product. Please try again.",
      );
    } finally {
      setRecallingBatch(null);
    }
  }

  async function submitRegistration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRegistrationError("");
    setQrDataUrl("");
    setQrError("");

    const cleaned: RegisterProductRequest = {
      productName: form.productName.trim(),
      manufacturer: user?.manufacturer || "",
      manufactureDate: form.manufactureDate,
      expiryDate: form.expiryDate,
    };

    if (!cleaned.productName || !cleaned.manufacturer || !cleaned.manufactureDate || !cleaned.expiryDate) {
      setRegistrationError("Please complete all fields.");
      return;
    }
    if (cleaned.expiryDate <= cleaned.manufactureDate) {
      setRegistrationError("Expiry date must be after manufacture date.");
      return;
    }

    setRegistering(true);
    try {
      const result = await registerProduct(cleaned);
      setRegistration(result);
      setForm({ productName: "", manufacturer: "", manufactureDate: "", expiryDate: "" });
      await loadProducts("refresh");
    } catch (requestError) {
      setRegistrationError(
        requestError instanceof Error
          ? requestError.message
          : "Product registration failed. Please try again.",
      );
    } finally {
      setRegistering(false);
    }
  }

  async function generateRegistrationQr() {
    if (!registration?.batchId) return;
    setQrError("");
    setQrDataUrl("");
    try {
      const verificationUrl = `${window.location.origin}/verify?batchId=${encodeURIComponent(registration.batchId)}`;
      const dataUrl = await QRCode.toDataURL(verificationUrl, {
        errorCorrectionLevel: "M",
        margin: 2,
        width: 280,
        color: { dark: "#090b11", light: "#ffffff" },
      });
      setQrDataUrl(dataUrl);
    } catch {
      setQrError("QR code could not be generated. Please try again.");
    }
  }

  function startRegistration() {
    setActiveView("register");
    setRegistration(null);
    setRegistrationError("");
    setQrDataUrl("");
    setQrError("");
  }

  async function openProductDetails(product: Product) {
    setSelectedProduct(product);
    setHistory(null);
    setHistoryError("");
    setHistoryLoading(true);
    try {
      const response = await fetch(
        `${API_URL}/api/products/${encodeURIComponent(product.batch_id)}/history`,
      );
      if (!response.ok) throw new Error(await readError(response));
      const result: ProductHistory = await response.json();
      setHistory(result);
      setSelectedProduct(result.product);
    } catch (requestError) {
      setHistoryError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load product audit history.",
      );
    } finally {
      setHistoryLoading(false);
    }
  }

  const verifiedProducts = products.filter((product) => product.blockchainVerification?.status !== "UNAVAILABLE");
  const validCount = verifiedProducts.filter((product) => !isRecalled(product.recalled)).length;
  const recalledCount = verifiedProducts.filter((product) => isRecalled(product.recalled)).length;
  const unverifiedCount = products.length - verifiedProducts.length;
  const filteredProducts = products.filter((product) => {
    const recalled = isRecalled(product.recalled);
    const unverified = product.blockchainVerification?.status === "UNAVAILABLE";
    const matchesStatus = statusFilter === "ALL"
      || (statusFilter === "UNVERIFIED" ? unverified : !unverified && (statusFilter === "RECALLED" ? recalled : !recalled));
    const term = search.trim().toLocaleLowerCase();
    const matchesSearch = !term || [product.batch_id, product.product_name, product.manufacturer]
      .some((field) => field.toLocaleLowerCase().includes(term));
    return matchesStatus && matchesSearch;
  });

  if (authLoading) {
    return <div className="manufacturer-app"><div className="manufacturer-auth-gate" role="status">Checking manufacturer session…</div></div>;
  }

  if (authError) {
    return (
      <div className="manufacturer-app">
        <div className="manufacturer-auth-gate">
          <div className="manufacturer-alert" role="alert">{authError}</div>
          <button className="manufacturer-refresh" type="button" onClick={() => void checkSession()}>
            Retry connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="manufacturer-app">
      <header className="navbar manufacturer-navbar">
        <a className="logo manufacturer-brand" href="/" aria-label="ChainRecall home">
          <span className="logo-mark">CR</span>
          <span>ChainRecall</span>
        </a>
        <nav className="manufacturer-nav" aria-label="Main navigation">
          <a href="/">Verify Product</a>
          <button
            type="button"
            className={activeView === "dashboard" ? "manufacturer-nav-active" : ""}
            aria-current={activeView === "dashboard" ? "page" : undefined}
            onClick={() => setActiveView("dashboard")}
          >
            Dashboard
          </button>
          {user?.role === "MANUFACTURER" && (
            <button
              type="button"
              className={activeView === "register" ? "manufacturer-nav-active" : ""}
              aria-current={activeView === "register" ? "page" : undefined}
              onClick={startRegistration}
            >
              Register Product
            </button>
          )}
        </nav>
        <div className="manufacturer-account-controls">
          <span className="manufacturer-account-identity">
            <strong>{user?.manufacturer || "Administrator"}</strong>
            <small>{user?.role === "ADMIN" ? "Administrator" : "Manufacturer"}</small>
          </span>
          <button className="manufacturer-logout" type="button" onClick={() => void logout()}>
            Logout
          </button>
        </div>
      </header>

      <main className="manufacturer-dashboard">
        {activeView === "dashboard" ? (
          <>
            <section className="manufacturer-heading">
              <div>
                <p className="manufacturer-eyebrow">CHAINRECALL / OPERATIONS</p>
                <h1>Manufacturer Portal</h1>
                <p className="manufacturer-intro">
                  Monitor registered product batches and manage recall status.
                </p>
              </div>
              <div className="manufacturer-heading-actions">
                {user?.role === "MANUFACTURER" && (
                  <button className="manufacturer-register-cta" type="button" onClick={startRegistration}>
                    + Register Product
                  </button>
                )}
                <button
                  className="manufacturer-refresh"
                  type="button"
                  onClick={() => void loadProducts("refresh")}
                  disabled={refreshing || loading}
                >
                  <span aria-hidden="true">↻</span> {refreshing ? "Refreshing…" : "Refresh"}
                </button>
              </div>
            </section>

            <section className="manufacturer-stats" aria-label="Product analytics">
              <article className="manufacturer-stat">
                <span className="manufacturer-stat-label">Total Products</span>
                <strong>{loading ? "—" : products.length}</strong>
                <span className="manufacturer-stat-note">Registered batches</span>
              </article>
              <article className="manufacturer-stat">
                <span className="manufacturer-stat-label">Valid Products</span>
                <strong className="manufacturer-valid-number">{loading ? "—" : validCount}</strong>
                <span className="manufacturer-stat-note">Currently active</span>
              </article>
              <article className="manufacturer-stat">
                <span className="manufacturer-stat-label">Recalled Products</span>
                <strong className="manufacturer-recalled-number">{loading ? "—" : recalledCount}</strong>
                <span className="manufacturer-stat-note">Recall status confirmed</span>
              </article>
              <article className="manufacturer-stat">
                <span className="manufacturer-stat-label">Unverified Products</span>
                <strong>{loading ? "—" : unverifiedCount}</strong>
                <span className="manufacturer-stat-note">Requires chain reconciliation</span>
              </article>
              <article className="manufacturer-stat">
                <span className="manufacturer-stat-label">Total Verifications</span>
                <strong>{loading ? "—" : analytics.totalVerifications}</strong>
                <span className="manufacturer-stat-note">Recorded verification events</span>
              </article>
              <article className="manufacturer-stat">
                <span className="manufacturer-stat-label">Recalled Verifications</span>
                <strong className="manufacturer-recalled-number">{loading ? "—" : analytics.recalledProductVerifications}</strong>
                <span className="manufacturer-stat-note">Checks logged as recalled</span>
              </article>
            </section>

            <section className="manufacturer-inventory">
              <div className="manufacturer-inventory-heading">
                <div>
                  <p className="manufacturer-eyebrow">INVENTORY</p>
                  <h2>Product batches</h2>
                </div>
                {!loading && <span className="manufacturer-count">{filteredProducts.length} of {products.length} records</span>}
              </div>

              <div className="manufacturer-inventory-controls">
                <label className="manufacturer-search">
                  <span className="manufacturer-search-icon" aria-hidden="true">⌕</span>
                  <input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search batch, product, or manufacturer"
                    aria-label="Search products"
                  />
                </label>
                <div className="manufacturer-filter-group" role="group" aria-label="Filter by product status">
                {(["ALL", "VALID", "RECALLED", "UNVERIFIED"] as const).map((filter) => (
                    <button
                      key={filter}
                      className={statusFilter === filter ? "manufacturer-filter-active" : ""}
                      type="button"
                      aria-pressed={statusFilter === filter}
                      onClick={() => setStatusFilter(filter)}
                    >
                      {filter === "ALL" ? "All" : filter === "VALID" ? "Valid" : filter === "RECALLED" ? "Recalled" : "Unverified"}
                    </button>
                  ))}
                </div>
              </div>

              {loading ? (
                <div className="manufacturer-state" role="status">Loading product inventory…</div>
              ) : products.length === 0 ? (
                <div className="manufacturer-state">
                  <strong>No products registered yet</strong>
                  <span>Registered batches will appear here.</span>
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="manufacturer-state">
                  <strong>No matching products</strong>
                  <span>Change the search or status filter to see more batches.</span>
                </div>
              ) : (
                <div className="manufacturer-table-wrap">
                  <table className="manufacturer-table">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Manufacturer</th>
                        <th>Batch ID</th>
                        <th>Manufactured</th>
                        <th>Expires</th>
                        <th>Verifications</th>
                        <th>Last Verified</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredProducts.map((product) => {
                        const recalled = isRecalled(product.recalled);
                        const statusLabel = product.blockchainVerification?.status === "UNAVAILABLE"
                          ? "UNVERIFIED"
                          : recalled ? "RECALLED" : "VALID";
                        const isRecalling = recallingBatch === product.batch_id;
                        return (
                          <tr key={product.product_id ?? product.batch_id}>
                            <td className="manufacturer-product-name">{product.product_name}</td>
                            <td>{product.manufacturer}</td>
                            <td className="manufacturer-batch-id">{product.batch_id}</td>
                            <td>{formatDate(product.manufacture_date)}</td>
                            <td>{formatDate(product.expiry_date)}</td>
                            <td className="manufacturer-verification-count">{Number(product.verification_count || 0)}</td>
                            <td>{formatDateTime(product.last_verified_at)}</td>
                            <td>
                              <span className={`manufacturer-status ${product.blockchainVerification?.status === "UNAVAILABLE" ? "" : recalled ? "is-recalled" : "is-valid"}`}>
                                <span aria-hidden="true" /> {statusLabel}
                              </span>
                            </td>
                            <td>
                              <div className="manufacturer-actions">
                                <button
                                  className="manufacturer-details-button"
                                  type="button"
                                  onClick={() => void openProductDetails(product)}
                                >
                                  View Details
                                </button>
                                {product.blockchainVerification?.status === "UNAVAILABLE" ? (
                                  <>
                                    {user?.role === "MANUFACTURER" && (
                                      <button
                                        className="manufacturer-recall-button"
                                        type="button"
                                        disabled
                                        title="This batch is not registered on the current blockchain. Reconcile the batch before initiating a recall."
                                      >
                                        Recall Product
                                      </button>
                                    )}
                                    <span className="manufacturer-recall-unavailable">
                                      This batch is not registered on the current blockchain. Reconcile the batch before initiating a recall.
                                    </span>
                                  </>
                                ) : recalled ? (
                                  <span className="manufacturer-recalled-action">RECALLED</span>
                                ) : user?.role === "MANUFACTURER" ? (
                                  <button
                                    className="manufacturer-recall-button"
                                    type="button"
                                    onClick={() => void recallProduct(product)}
                                    disabled={recallingBatch !== null}
                                  >
                                    {isRecalling ? "Recalling…" : "Recall Product"}
                                  </button>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        ) : (
          <section className="manufacturer-registration-view">
            <div className="manufacturer-heading">
              <div>
                <p className="manufacturer-eyebrow">CHAINRECALL / NEW BATCH</p>
                <h1>Register Product</h1>
                <p className="manufacturer-intro">
                  Add a product batch to the ChainRecall ledger.
                </p>
              </div>
            </div>

            {!registration ? (
              <form className="manufacturer-registration-card" onSubmit={(event) => void submitRegistration(event)}>
                <div className="manufacturer-registration-card-heading">
                  <span className="manufacturer-form-icon" aria-hidden="true">+</span>
                  <div>
                    <h2>Product information</h2>
                    <p>Batch ID is generated automatically after registration.</p>
                  </div>
                </div>

                {registrationError && <div className="manufacturer-form-error" role="alert">{registrationError}</div>}

                <label className="manufacturer-field">
                  <span>Product Name</span>
                  <input
                    type="text"
                    value={form.productName}
                    onChange={(event) => setForm({ ...form, productName: event.target.value })}
                    placeholder="e.g. Amoxicillin 500mg"
                    autoComplete="off"
                    required
                  />
                </label>

                <div className="manufacturer-identity-field">
                  <span>Manufacturer</span>
                  <strong>{user?.manufacturer}</strong>
                  <small>Determined by your authenticated account</small>
                </div>

                <div className="manufacturer-date-fields">
                  <label className="manufacturer-field">
                    <span>Manufacture Date</span>
                    <input
                      type="date"
                      value={form.manufactureDate}
                      onChange={(event) => setForm({ ...form, manufactureDate: event.target.value })}
                      required
                    />
                  </label>
                  <label className="manufacturer-field">
                    <span>Expiry Date</span>
                    <input
                      type="date"
                      value={form.expiryDate}
                      min={form.manufactureDate || undefined}
                      onChange={(event) => setForm({ ...form, expiryDate: event.target.value })}
                      required
                    />
                  </label>
                </div>

                <button className="manufacturer-submit" type="submit" disabled={registering}>
                  {registering ? (
                    <><span className="manufacturer-spinner" aria-hidden="true" /> Registering on blockchain...</>
                  ) : "Register Product"}
                </button>
              </form>
            ) : (
              <section className="manufacturer-registration-success" aria-live="polite">
                <div className="manufacturer-success-heading">
                  <span className="manufacturer-success-icon" aria-hidden="true">✓</span>
                  <div>
                    <p className="manufacturer-eyebrow">ON-CHAIN CONFIRMED</p>
                    <h2>Registration Successful</h2>
                  </div>
                </div>
                <dl className="manufacturer-registration-result">
                  <div><dt>Product Name</dt><dd>{registration.productName}</dd></div>
                  <div><dt>Manufacturer</dt><dd>{registration.manufacturer}</dd></div>
                  <div><dt>Generated Batch ID</dt><dd>{registration.batchId}</dd></div>
                  <div><dt>Transaction Hash</dt><dd className="manufacturer-result-mono">{registration.transactionHash}</dd></div>
                  <div><dt>Contract Address</dt><dd className="manufacturer-result-mono">{registration.contractAddress}</dd></div>
                </dl>

                <div className="manufacturer-qr-section">
                  <div>
                    <h3>Product verification QR</h3>
                    <p>Scan to open the ChainRecall verification page for this batch.</p>
                  </div>
                  {qrDataUrl ? (
                    <div className="manufacturer-qr-result">
                      <img src={qrDataUrl} alt={`Verification QR code for batch ${registration.batchId}`} />
                      <a
                        className="manufacturer-qr-download"
                        href={qrDataUrl}
                        download={`chainrecall-${registration.batchId}.png`}
                      >
                        Download PNG
                      </a>
                    </div>
                  ) : (
                    <button className="manufacturer-qr-generate" type="button" onClick={() => void generateRegistrationQr()}>
                      Generate QR Code
                    </button>
                  )}
                  {qrError && <p className="manufacturer-qr-error" role="alert">{qrError}</p>}
                </div>

                <div className="manufacturer-success-actions">
                  <button className="manufacturer-submit" type="button" onClick={() => setActiveView("dashboard")}>
                    View Dashboard
                  </button>
                  <button className="manufacturer-secondary-action" type="button" onClick={startRegistration}>
                    Register Another Product
                  </button>
                </div>
              </section>
            )}
          </section>
        )}

        {error && (
          <div className="manufacturer-alert" role="alert">
            <span>{error}</span>
            <button type="button" onClick={() => void loadProducts("refresh")} disabled={refreshing}>
              Try again
            </button>
          </div>
        )}

      </main>

      <footer className="manufacturer-footer">
        <span>ChainRecall · Pharmaceutical Product Verification</span>
        <span>Powered by Blockchain</span>
      </footer>

      {selectedProduct && (
        <div
          className="manufacturer-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedProduct(null);
          }}
        >
          <section
            className="manufacturer-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="manufacturer-modal-title"
          >
            <div className="manufacturer-modal-heading">
              <div>
                <p className="manufacturer-eyebrow">PRODUCT RECORD</p>
                <h2 id="manufacturer-modal-title">Product details</h2>
              </div>
              <button
                className="manufacturer-modal-close"
                type="button"
                onClick={() => setSelectedProduct(null)}
                aria-label="Close product details"
              >
                ×
              </button>
            </div>
            <section className="manufacturer-detail-section">
              <h3>Product information</h3>
              <dl className="manufacturer-detail-list">
                <div><dt>Product name</dt><dd>{selectedProduct.product_name}</dd></div>
                <div><dt>Manufacturer</dt><dd>{selectedProduct.manufacturer}</dd></div>
                <div><dt>Batch ID</dt><dd>{selectedProduct.batch_id}</dd></div>
                <div><dt>Manufacture date</dt><dd>{formatDate(selectedProduct.manufacture_date)}</dd></div>
                <div><dt>Expiry date</dt><dd>{formatDate(selectedProduct.expiry_date)}</dd></div>
                <div>
                  <dt>Current status</dt>
                  <dd>
                    <span className={`manufacturer-status ${selectedProduct.blockchainVerification?.status === "UNAVAILABLE" ? "" : isRecalled(selectedProduct.recalled) ? "is-recalled" : "is-valid"}`}>
                      <span aria-hidden="true" /> {selectedProduct.blockchainVerification?.status === "UNAVAILABLE" ? "UNVERIFIED" : isRecalled(selectedProduct.recalled) ? "RECALLED" : "VALID"}
                    </span>
                    {selectedProduct.blockchainVerification?.status === "UNAVAILABLE" && (
                      <p>{selectedProduct.blockchainVerification.message}</p>
                    )}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="manufacturer-detail-section">
              <h3>Blockchain information</h3>
              <dl className="manufacturer-detail-list">
                <div className="manufacturer-detail-wide">
                  <dt>Contract address</dt>
                  <dd>{selectedProduct.contract_address || "—"}</dd>
                </div>
                <div className="manufacturer-detail-wide">
                  <dt>Registration transaction hash</dt>
                  <dd>{selectedProduct.registration_tx_hash || "—"}</dd>
                </div>
                {isRecalled(selectedProduct.recalled) && selectedProduct.recall_tx_hash && (
                  <div className="manufacturer-detail-wide">
                    <dt>Recall transaction hash</dt>
                    <dd>{selectedProduct.recall_tx_hash}</dd>
                  </div>
                )}
              </dl>
            </section>

            <section className="manufacturer-detail-section manufacturer-audit-section">
              <div className="manufacturer-audit-heading">
                <h3>Audit history</h3>
                {history && <span>{history.events.length} recorded events</span>}
              </div>
              {historyLoading ? (
                <div className="manufacturer-history-state" role="status">Loading audit history…</div>
              ) : historyError ? (
                <div className="manufacturer-history-error" role="alert">
                  <span>{historyError}</span>
                  <button type="button" onClick={() => void openProductDetails(selectedProduct)}>Retry</button>
                </div>
              ) : history?.events.length ? (
                <ol className="manufacturer-timeline">
                  {history.events.map((event) => {
                    const title = event.type === "registration"
                      ? "Product Registered"
                      : event.type === "recall"
                        ? "Product Recalled"
                        : "Product Verified";
                    return (
                      <li className={`manufacturer-timeline-event event-${event.type}`} key={event.id}>
                        <span className="manufacturer-timeline-marker" aria-hidden="true" />
                        <div className="manufacturer-timeline-content">
                          <div className="manufacturer-timeline-title-row">
                            <strong>{title}</strong>
                            <time>{formatDateTime(event.occurredAt)}</time>
                          </div>
                          <p>
                            {event.type === "verification"
                              ? `Verification result: ${event.result}`
                              : event.description}
                          </p>
                          {event.transactionHash && (
                            <div className="manufacturer-timeline-hash">
                              TX: <span>{event.transactionHash}</span>
                            </div>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <div className="manufacturer-history-state">No audit events are available for this product.</div>
              )}
            </section>
          </section>
        </div>
      )}
    </div>
  );
}

export default Manufacturer;
