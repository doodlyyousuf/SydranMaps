import { NextResponse } from 'next/server';

/**
 * Root API health-check.
 * Useful for the Fabric mod (and the mod panel UI) to verify the server is alive.
 */
export async function GET() {
  return NextResponse.json({
    name: 'Sydran Maps API',
    version: '1.0.0',
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
}
