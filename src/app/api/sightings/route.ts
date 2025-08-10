import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const surveyId = searchParams.get('survey_id')
    
    const client = await pool.connect()
    let query = 'SELECT id, survey_id, species_id, transect_id, count FROM sighting'
    let params: any[] = []
    
    if (surveyId) {
      query += ' WHERE survey_id = $1'
      params = [surveyId]
    }
    
    query += ' ORDER BY id'
    
    const result = await client.query(query, params)
    client.release()
    
    return NextResponse.json(result.rows)
  } catch (error) {
    console.error('Error fetching sightings:', error)
    return NextResponse.json({ error: 'Failed to fetch sightings' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { survey_id, species_id, transect_id, count } = body
    
    const client = await pool.connect()
    const result = await client.query(`
      INSERT INTO sighting (survey_id, species_id, transect_id, count)
      VALUES ($1, $2, $3, $4) RETURNING *
    `, [survey_id, species_id, transect_id, count])
    client.release()
    
    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error('Error creating sighting:', error)
    return NextResponse.json({ error: 'Failed to create sighting' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { id, species_id, transect_id, count } = body
    
    const client = await pool.connect()
    const result = await client.query(`
      UPDATE sighting SET species_id = $2, transect_id = $3, count = $4
      WHERE id = $1 RETURNING *
    `, [id, species_id, transect_id, count])
    client.release()
    
    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error('Error updating sighting:', error)
    return NextResponse.json({ error: 'Failed to update sighting' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json({ error: 'Missing sighting ID' }, { status: 400 })
    }
    
    const client = await pool.connect()
    await client.query('DELETE FROM sighting WHERE id = $1', [id])
    client.release()
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting sighting:', error)
    return NextResponse.json({ error: 'Failed to delete sighting' }, { status: 500 })
  }
}