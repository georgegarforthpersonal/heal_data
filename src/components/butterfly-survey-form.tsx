"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Trash2, Plus, Save, Edit3, Calendar, Clock, Thermometer } from "lucide-react"
import { useState, useEffect } from "react"

interface Surveyor {
  id: number
  first_name: string
  last_name: string | null
}

interface Species {
  id: number
  name: string
}

interface Transect {
  id: number
  number: number
  name: string
}

interface Survey {
  id: number
  date: string
  start_time: string
  end_time: string
  sun_percentage: number
  temperature_celsius: number
  conditions_met: boolean
  surveyor_id: number
}

interface Sighting {
  id: number
  survey_id: number
  species_id: number
  transect_id: number
  count: number
}

export default function ButterflyurveyForm() {
  const [sightings, setSightings] = useState<Sighting[]>([])
  const [species, setSpecies] = useState<Species[]>([])
  const [transects, setTransects] = useState<Transect[]>([])
  const [surveyors, setSurveyors] = useState<Surveyor[]>([])
  const [surveys, setSurveys] = useState<Survey[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [currentSurveyId, setCurrentSurveyId] = useState<number | null>(null)
  const [showNewSurveyModal, setShowNewSurveyModal] = useState(false)
  const [newSurvey, setNewSurvey] = useState({
    date: new Date().toISOString().split("T")[0],
    start_time: "",
    end_time: "",
    sun_percentage: 50,
    temperature_celsius: 20,
    conditions_met: false,
    surveyor_id: 1,
  })

  const [editingSurvey, setEditingSurvey] = useState(false)

  const [undoStack, setUndoStack] = useState<{ sightings: Sighting[]; surveys: Survey[] }[]>([])
  const [redoStack, setRedoStack] = useState<{ sightings: Sighting[]; surveys: Survey[] }[]>([])

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)

        // Fetch all data from API
        const [surveyorRes, sightingRes, speciesRes, transectRes, surveyRes] = await Promise.all([
          fetch('/api/surveyors'),
          fetch('/api/sightings'),
          fetch('/api/species'),
          fetch('/api/transects'),
          fetch('/api/surveys'),
        ])

        // Check if all requests were successful
        if (!surveyorRes.ok || !sightingRes.ok || !speciesRes.ok || !transectRes.ok || !surveyRes.ok) {
          throw new Error('One or more API requests failed')
        }

        // Parse JSON data
        const [surveyorData, sightingData, speciesData, transectData, surveyData] = await Promise.all([
          surveyorRes.json(),
          sightingRes.json(),
          speciesRes.json(),
          transectRes.json(),
          surveyRes.json(),
        ])

        // Set state with parsed data
        setSurveyors(surveyorData)
        setSpecies(speciesData)
        setTransects(transectData)
        setSurveys(surveyData)
        setCurrentSurveyId(surveyData[0]?.id || null)
        setSightings(sightingData)

        setLoading(false)
      } catch (err) {
        console.error("Error loading data:", err)
        setError("Failed to load survey data. Please check the database connection.")
        setLoading(false)
      }
    }

    loadData()
  }, [])

  const getSpeciesName = (id: number) => species.find((s) => s.id === id)?.name || "Unknown"
  const getTransectName = (id: number) => {
    const transect = transects.find((t) => t.id === id)
    return transect ? `${transect.number}. ${transect.name}` : "Unknown"
  }
  const getSurveyorName = (id: number) => {
    const surveyor = surveyors.find((s) => s.id === id)
    return surveyor ? `${surveyor.first_name} ${surveyor.last_name || ""}`.trim() : "Unknown"
  }

  const saveToUndoStack = () => {
    const currentState = { sightings, surveys }
    setUndoStack((prev) => [...prev.slice(-19), currentState]) // Keep last 20 states
    setRedoStack([]) // Clear redo stack when new action is performed
  }

  const undo = () => {
    if (undoStack.length === 0) return

    const currentState = { sightings, surveys }
    const previousState = undoStack[undoStack.length - 1]

    setRedoStack((prev) => [currentState, ...prev.slice(0, 19)])
    setUndoStack((prev) => prev.slice(0, -1))

    setSightings(previousState.sightings)
    setSurveys(previousState.surveys)
  }

  const redo = () => {
    if (redoStack.length === 0) return

    const currentState = { sightings, surveys }
    const nextState = redoStack[0]

    setUndoStack((prev) => [...prev.slice(-19), currentState])
    setRedoStack((prev) => prev.slice(1))

    setSightings(nextState.sightings)
    setSurveys(nextState.surveys)
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault()
        undo()
      } else if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault()
        redo()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [undoStack, redoStack, sightings, surveys])

  const currentSurvey = surveys.find((s) => s.id === currentSurveyId) || surveys[0]
  const currentSurveyor = currentSurvey ? getSurveyorName(currentSurvey.surveyor_id) : "Unknown"

  const createNewSurvey = async () => {
    try {
      const response = await fetch('/api/surveys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSurvey)
      })

      if (!response.ok) throw new Error('Failed to create survey')

      const survey = await response.json()
      setSurveys([survey, ...surveys])
      setCurrentSurveyId(survey.id)
      setShowNewSurveyModal(false)
      
      // Reset form
      setNewSurvey({
        date: new Date().toISOString().split("T")[0],
        start_time: "",
        end_time: "",
        sun_percentage: 50,
        temperature_celsius: 20,
        conditions_met: false,
        surveyor_id: surveyors[0]?.id || 1,
      })
    } catch (error) {
      console.error('Error creating survey:', error)
      setError('Failed to create survey')
    }
  }

  const filteredSightings = sightings.filter((s) => s.survey_id === currentSurveyId)

  const addNewSighting = async () => {
    if (!currentSurveyId) return

    try {
      const newSightingData = {
        survey_id: currentSurveyId,
        species_id: species[0]?.id || 1,
        transect_id: transects[0]?.id || 1,
        count: 1,
      }

      const response = await fetch('/api/sightings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSightingData)
      })

      if (!response.ok) throw new Error('Failed to create sighting')

      const sighting = await response.json()
      setSightings([...sightings, sighting])
      saveToUndoStack()
    } catch (error) {
      console.error('Error creating sighting:', error)
      setError('Failed to create sighting')
    }
  }

  const deleteSighting = async (id: number) => {
    try {
      const response = await fetch(`/api/sightings?id=${id}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Failed to delete sighting')

      setSightings(sightings.filter((sighting) => sighting.id !== id))
      saveToUndoStack()
    } catch (error) {
      console.error('Error deleting sighting:', error)
      setError('Failed to delete sighting')
    }
  }

  const updateSighting = async (id: number, field: keyof Sighting, value: string | number) => {
    // Save to undo stack for species/transect changes
    if (field === "species_id" || field === "transect_id") {
      saveToUndoStack()
    }

    // Update local state immediately
    setSightings((prevSightings) =>
      prevSightings.map((sighting) => {
        if (sighting.id === id) {
          return { ...sighting, [field]: value }
        }
        return sighting
      }),
    )

    // Update in database
    try {
      const sighting = sightings.find(s => s.id === id)
      if (!sighting) return

      const updatedSighting = { ...sighting, [field]: value }

      const response = await fetch('/api/sightings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: updatedSighting.id,
          species_id: updatedSighting.species_id,
          transect_id: updatedSighting.transect_id,
          count: updatedSighting.count
        })
      })

      if (!response.ok) throw new Error('Failed to update sighting')
    } catch (error) {
      console.error('Error updating sighting:', error)
      // Revert local state on error
      setSightings(sightings)
    }
  }

  const updateSurvey = async (field: keyof Survey, value: string | number | boolean) => {
    if (!currentSurveyId || !currentSurvey) return
    
    // Update local state immediately
    const updatedSurvey = { ...currentSurvey, [field]: value }
    setSurveys(surveys.map((survey) => (survey.id === currentSurveyId ? updatedSurvey : survey)))

    // Update in database
    try {
      const response = await fetch('/api/surveys', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedSurvey)
      })

      if (!response.ok) throw new Error('Failed to update survey')
    } catch (error) {
      console.error('Error updating survey:', error)
      // Revert local state on error
      setSurveys(surveys.map((survey) => (survey.id === currentSurveyId ? currentSurvey : survey)))
    }
  }

  const handleSurveyEdit = () => {
    setEditingSurvey(!editingSurvey)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Loading butterfly survey data from database...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center text-red-600">
          <p className="text-lg font-semibold mb-2">Error Loading Data</p>
          <p>{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Survey Management */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Survey Management</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Select a survey or create a new one</p>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={currentSurveyId?.toString() || ""}
              onValueChange={(value) => setCurrentSurveyId(Number.parseInt(value))}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select survey" />
              </SelectTrigger>
              <SelectContent>
                {surveys.map((survey) => (
                  <SelectItem key={survey.id} value={survey.id.toString()}>
                    {new Date(survey.date).toLocaleDateString()} - {getSurveyorName(survey.surveyor_id)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => setShowNewSurveyModal(true)} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              New Survey
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* New Survey Modal */}
      {showNewSurveyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle>Create New Survey</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Date</label>
                <Input
                  type="date"
                  value={newSurvey.date}
                  onChange={(e) => setNewSurvey({ ...newSurvey, date: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-sm font-medium">Start Time</label>
                  <Input
                    type="time"
                    value={newSurvey.start_time}
                    onChange={(e) => setNewSurvey({ ...newSurvey, start_time: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">End Time</label>
                  <Input
                    type="time"
                    value={newSurvey.end_time}
                    onChange={(e) => setNewSurvey({ ...newSurvey, end_time: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Surveyor</label>
                <Select
                  value={newSurvey.surveyor_id.toString()}
                  onValueChange={(value) => setNewSurvey({ ...newSurvey, surveyor_id: Number.parseInt(value) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {surveyors.map((surveyor) => (
                      <SelectItem key={surveyor.id} value={surveyor.id.toString()}>
                        {surveyor.first_name} {surveyor.last_name || ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-sm font-medium">Sun %</label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={newSurvey.sun_percentage}
                    onChange={(e) => setNewSurvey({ ...newSurvey, sun_percentage: Number.parseInt(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Temperature °C</label>
                  <Input
                    type="number"
                    value={newSurvey.temperature_celsius}
                    onChange={(e) =>
                      setNewSurvey({ ...newSurvey, temperature_celsius: Number.parseFloat(e.target.value) })
                    }
                  />
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="conditions_met"
                  checked={newSurvey.conditions_met}
                  onChange={(e) => setNewSurvey({ ...newSurvey, conditions_met: e.target.checked })}
                />
                <label htmlFor="conditions_met" className="text-sm font-medium">
                  Survey conditions met
                </label>
              </div>
              <div className="flex justify-end space-x-2 pt-4">
                <Button variant="outline" onClick={() => setShowNewSurveyModal(false)}>
                  Cancel
                </Button>
                <Button onClick={createNewSurvey}>Create Survey</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Survey Information - Editable */}
      {currentSurvey && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Survey Details</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {editingSurvey ? "Edit survey information" : "Click edit to modify survey details"}
              </p>
            </div>
            <Button
              onClick={() => handleSurveyEdit()}
              variant={editingSurvey ? "default" : "outline"}
              className="flex items-center gap-2"
            >
              {editingSurvey ? <Save className="h-4 w-4" /> : <Edit3 className="h-4 w-4" />}
              {editingSurvey ? "Save" : "Edit"}
            </Button>
          </CardHeader>
          <CardContent>
            {editingSurvey ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Date</label>
                  <Input
                    type="date"
                    value={currentSurvey.date}
                    onChange={(e) => updateSurvey("date", e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Surveyor</label>
                  <Select
                    value={currentSurvey.surveyor_id.toString()}
                    onValueChange={(value) => updateSurvey("surveyor_id", Number.parseInt(value))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {surveyors.map((surveyor) => (
                        <SelectItem key={surveyor.id} value={surveyor.id.toString()}>
                          {surveyor.first_name} {surveyor.last_name || ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Start Time</label>
                  <Input
                    type="time"
                    value={currentSurvey.start_time}
                    onChange={(e) => updateSurvey("start_time", e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">End Time</label>
                  <Input
                    type="time"
                    value={currentSurvey.end_time}
                    onChange={(e) => updateSurvey("end_time", e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Sun Percentage</label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={currentSurvey.sun_percentage}
                    onChange={(e) => updateSurvey("sun_percentage", Number.parseInt(e.target.value))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Temperature (°C)</label>
                  <Input
                    type="number"
                    value={currentSurvey.temperature_celsius}
                    onChange={(e) => updateSurvey("temperature_celsius", Number.parseFloat(e.target.value))}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="edit_conditions_met"
                    checked={currentSurvey.conditions_met}
                    onChange={(e) => updateSurvey("conditions_met", e.target.checked)}
                  />
                  <label htmlFor="edit_conditions_met" className="text-sm font-medium">
                    Survey conditions met
                  </label>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-blue-600" />
                  <div>
                    <p className="text-sm text-gray-600">Survey Date</p>
                    <p className="font-medium">{new Date(currentSurvey.date).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-green-600" />
                  <div>
                    <p className="text-sm text-gray-600">Time</p>
                    <p className="font-medium">
                      {currentSurvey.start_time} - {currentSurvey.end_time}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Thermometer className="h-4 w-4 text-orange-600" />
                  <div>
                    <p className="text-sm text-gray-600">Conditions</p>
                    <p className="font-medium">
                      {currentSurvey.temperature_celsius}°C, {currentSurvey.sun_percentage}% sun
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Surveyor</p>
                  <p className="font-medium">{currentSurveyor}</p>
                  <Badge variant={currentSurvey.conditions_met ? "default" : "destructive"} className="mt-1">
                    {currentSurvey.conditions_met ? "Conditions Met" : "Conditions Not Met"}
                  </Badge>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Sightings Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Butterfly Sightings</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Record butterfly sightings for this survey. Data stored in PostgreSQL database.
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-200">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border border-gray-200 px-4 py-3 text-left text-sm font-medium text-gray-900">
                    Species
                  </th>
                  <th className="border border-gray-200 px-4 py-3 text-left text-sm font-medium text-gray-900">
                    Transect
                  </th>
                  <th className="border border-gray-200 px-4 py-3 text-left text-sm font-medium text-gray-900">
                    Count
                  </th>
                  <th className="border border-gray-200 px-4 py-3 text-left text-sm font-medium text-gray-900">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredSightings.map((sighting) => (
                  <tr key={sighting.id} className="hover:bg-gray-50">
                    <td className="border border-gray-200 px-4 py-3">
                      <Select
                        value={sighting.species_id.toString()}
                        onValueChange={(value) => {
                          updateSighting(sighting.id, "species_id", Number.parseInt(value))
                        }}
                      >
                        <SelectTrigger className="w-full h-8">
                          <SelectValue placeholder="Select Species" />
                        </SelectTrigger>
                        <SelectContent>
                          {species.map((spec) => (
                            <SelectItem key={spec.id} value={spec.id.toString()}>
                              {spec.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="border border-gray-200 px-4 py-3">
                      <Select
                        value={sighting.transect_id.toString()}
                        onValueChange={(value) => {
                          updateSighting(sighting.id, "transect_id", Number.parseInt(value))
                        }}
                      >
                        <SelectTrigger className="w-full h-8">
                          <SelectValue placeholder="Select Transect" />
                        </SelectTrigger>
                        <SelectContent>
                          {transects.map((transect) => (
                            <SelectItem key={transect.id} value={transect.id.toString()}>
                              {transect.number}. {transect.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="border border-gray-200 px-4 py-3">
                      <Input
                        type="number"
                        min="1"
                        value={sighting.count}
                        onChange={(e) => {
                          const newValue = Number.parseInt(e.target.value) || 1
                          updateSighting(sighting.id, "count", newValue)
                        }}
                        className="w-24 h-8"
                      />
                    </td>
                    <td className="border border-gray-200 px-4 py-3">
                      <Button size="icon" variant="destructive" onClick={() => deleteSighting(sighting.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Add sighting button */}
          <div className="mt-4 flex justify-center">
            <Button onClick={addNewSighting} className="flex items-center gap-2" disabled={species.length === 0}>
              <Plus className="h-4 w-4" />
              Add Sighting
            </Button>
          </div>

          {filteredSightings.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">
                No sightings found for this survey. Add your first sighting to get started.
              </p>
              <Button
                onClick={addNewSighting}
                className="flex items-center gap-2 mx-auto"
                disabled={species.length === 0}
              >
                <Plus className="h-4 w-4" />
                Add First Sighting
              </Button>
            </div>
          )}

          <div className="mt-6 flex items-center justify-between text-sm text-gray-600">
            <span>Sightings in this survey: {filteredSightings.length}</span>
            <span>Butterflies counted: {filteredSightings.reduce((sum, s) => sum + s.count, 0)}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}