import { join } from 'node:path';
import { economyLeagues, economySnapshot } from '@/server/poe-ninja';

export const runtime = 'nodejs';
export async function GET(request: Request) {
  const cache = join(process.cwd(),'.cache','poe-ninja');
  try {
    const league = new URL(request.url).searchParams.get('league');
    const data = league ? await economySnapshot(league,cache) : await economyLeagues(cache);
    return Response.json(data,{headers:{'Cache-Control':'public, max-age=300'}});
  } catch (error) {
    return Response.json({error:error instanceof Error ? error.message : 'Price source unavailable'},{status:502});
  }
}
