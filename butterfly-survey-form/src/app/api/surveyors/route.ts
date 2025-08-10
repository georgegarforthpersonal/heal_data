import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function GET() {
  try {
    const client = await pool.connect()
    const result = await client.query('SELECT id, first_name, last_name FROM surveyor ORDER BY first_name')
    client.release()
    
    return NextResponse.json(result.rows)
  } catch (error) {
    console.error('Error fetching surveyors:', error)
    return NextResponse.json({ error: 'Failed to fetch surveyors' }, { status: 500 })
  }
}