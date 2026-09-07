import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---- Catalog gRPC Client ----
const CATALOG_PROTO_PATH = path.join(__dirname, "..", "proto", "catalog.proto");

const catalogPkgDef = protoLoader.loadSync(CATALOG_PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const catalogProto = grpc.loadPackageDefinition(catalogPkgDef).catalog;

const CATALOG_GRPC_URL = process.env.CATALOG_GRPC_URL || "catalog_service:50051";

const catalogClient = new catalogProto.CatalogService(
  CATALOG_GRPC_URL,
  grpc.credentials.createInsecure()
);

// ---- Cart gRPC Client ----
const CART_PROTO_PATH = path.join(__dirname, "..", "proto", "cart.proto");

const cartPkgDef = protoLoader.loadSync(CART_PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const cartProto = grpc.loadPackageDefinition(cartPkgDef).cart;

const CART_GRPC_URL = process.env.CART_GRPC_URL || "cart_service:50052";

const cartClient = new cartProto.CartService(
  CART_GRPC_URL,
  grpc.credentials.createInsecure()
);

// ---- Exported functions ----

// Get book details from Catalog Service via gRPC
export function getBookById(bookId) {
  return new Promise((resolve, reject) => {
    catalogClient.GetBook({ id: bookId }, (err, response) => {
      if (err) {
        reject(err);
      } else {
        resolve(response);
      }
    });
  });
}

// Clear user's cart via gRPC call to Cart Service
export function clearCart(userId) {
  return new Promise((resolve, reject) => {
    cartClient.ClearCart({ user_id: userId }, (err, response) => {
      if (err) {
        reject(err);
      } else {
        resolve(response);
      }
    });
  });
}
