import { AppError } from "../../../shared/errors/app-error.js";

export class DuplicateAssetError extends AppError {
  constructor() {
    super("Asset already exists for this symbol+exchange", "DUPLICATE_ASSET", 409);
  }
}

export class AssetNotFoundError extends AppError {
  constructor() {
    super("Asset not found", "ASSET_NOT_FOUND", 404);
  }
}
