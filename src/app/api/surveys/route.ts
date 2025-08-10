import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function GET() {
  try {
    const client = await pool.connect()
    const result = await client.query(`
      SELECT s.id, s.date, s.start_time, s.end_time, 
             s.sun_percentage, s.temperature_celsius, s.conditions_met,
             s.surveyor_id
      FROM survey s
      ORDER BY s.date DESC, s.start_time DESC
    `)
    client.release()
    
    return NextResponse.json(result.rows)
  } catch (error) {
    console.error('Error fetching surveys:', error)
    return NextResponse.json({ error: 'Failed to fetch surveys' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { date, start_time, end_time, sun_percentage, temperature_celsius, conditions_met, surveyor_id } = body
    
    const client = await pool.connect()
    const result = await client.query(`
      INSERT INTO survey (date, start_time, end_time, sun_percentage, temperature_celsius, conditions_met, surveyor_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *
    `, [date, start_time, end_time, sun_percentage, temperature_celsius, conditions_met, surveyor_id])
    client.release()
    
    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error('Error creating survey:', error)
    return NextResponse.json({ error: 'Failed to create survey' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { id, date, start_time, end_time, sun_percentage, temperature_celsius, conditions_met, surveyor_id } = body
    
    const client = await pool.connect()
    const result = await client.query(`
      UPDATE survey SET 
        date = $2, start_time = $3, end_time = $4, 
        sun_percentage = $5, temperature_celsius = $6, 
        conditions_met = $7, surveyor_id = $8
      WHERE id = $1 RETURNING *
    `, [id, date, start_time, end_time, sun_percentage, temperature_celsius, conditions_met, surveyor_id])
    client.release()
    
    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error('Error updating survey:', error)
    return NextResponse.json({ error: 'Failed to update survey' }, { status: 500 })
  }
}