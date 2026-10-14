export const API_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:5000").replace(/\/$/, "");

export type RegisterProductRequest = {
  productName: string;
  manufacturer: string;
  manufactureDate: string;
  expiryDate: string;
};

export type RegisterProductResponse = {
  message: string;
  productId: number;
  batchId: string;
  productName: string;
  manufacturer: string;
  manufactureDate: string;
  expiryDate: string;
  transactionHash: string;
  contractAddress: string;
};

export async function registerProduct(
  data: RegisterProductRequest
): Promise<RegisterProductResponse> {
  const response = await fetch(
    `${API_URL}/api/products/register`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    }
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result.message || "Product registration failed"
    );
  }

  return result;
}
