import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function GET() {
  try {
    const client = await pool.connect()
    const result = await client.query('SELECT id, name FROM species ORDER BY name')
    client.release()
    
    return NextResponse.json(result.rows)
  } catch (error) {
    console.error('Error fetching species:', error)
    return NextResponse.json({ error: 'Failed to fetch species' }, { status: 500 })
  }
}