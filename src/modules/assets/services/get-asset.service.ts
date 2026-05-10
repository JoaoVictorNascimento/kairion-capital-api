import { findAssetById } from "../repositories/assets.repository.js";
import { AssetNotFoundError } from "./errors.js";

export async function getAssetById(id: string) {
  const asset = await findAssetById(id);
  if (!asset) throw new AssetNotFoundError();
  return asset;
}

