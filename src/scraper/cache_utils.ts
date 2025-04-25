import { promises as fs } from 'fs';
import path from 'path';

export async function readCache(cacheFile: string): Promise<any[]> {
  try {
    const data = await fs.readFile(cacheFile, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
}

export async function writeCache(cacheFile: string, data: any[]): Promise<void> {
  await fs.writeFile(cacheFile, JSON.stringify(data, null, 2), 'utf8');
}

export function getCacheFileForSite(site: string): string {
  return path.join(__dirname, `cache_${site}.json`);
}
