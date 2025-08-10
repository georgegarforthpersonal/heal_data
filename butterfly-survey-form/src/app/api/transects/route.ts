import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function GET() {
  try {
    const client = await pool.connect()
    const result = await client.query('SELECT id, number, name FROM transect ORDER BY number')
    client.release()
    
    return NextResponse.json(result.rows)
  } catch (error) {
    console.error('Error fetching transects:', error)
    return NextResponse.json({ error: 'Failed to fetch transects' }, { status: 500 })
  }
}