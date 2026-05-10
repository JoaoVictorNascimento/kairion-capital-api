export class DuplicateAssetError extends Error {
  constructor() {
    super("Asset already exists for this symbol+exchange");
    this.name = "DuplicateAssetError";
  }
}

export class AssetNotFoundError extends Error {
  constructor() {
    super("Asset not found");
    this.name = "AssetNotFoundError";
  }
}
