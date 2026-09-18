// resumeService.ts
// Persistence layer hook for future database work.
// This is intentionally kept separate from the screen/component code so the UI remains clear.


import { getUserId, getjwt } from '../lib/supabase'

const api_url =import.meta.env.VITE_API_URL


export async function loadResumeFromDatabase(resume_id: string) {
  const jwt = await getjwt()
  const userId = await getUserId()
  const request = `${api_url}/get_resume/${userId}/${resume_id}`
  const headers = {'Authorization': `Bearer ${jwt}`}
  const response = await fetch(request, {headers: headers, method: 'GET' })

  return response.json()
}

export async function saveResumeToDatabase(data: object) {
   const jwt = await getjwt()
  const userId = await getUserId()
  const request = `${api_url}/add_resume/${userId}`
  const headers = {'Authorization': `Bearer ${jwt}`,'Content-Type': 'application/json'}
  const response = await fetch(request, {headers: headers, method: 'POST', body: JSON.stringify(data) })

  return response.json()
}

export async function deleteResumeFromDatabase(resume_id: string) {
  const jwt = await getjwt()
  const userId = await getUserId()
  const request = `${api_url}/delete_resume/${userId}/${resume_id}`
   const headers = {'Authorization': `Bearer ${jwt}`}
  const response = await fetch(request, {headers: headers, method: 'DELETE' })

  return response.json()
}

export async function updateResumeToDatabase(resume_id: string,data: object) {
  const jwt = await getjwt()
  const userId = await getUserId()
  const request = `${api_url}/update_resume/${userId}/${resume_id}`
  const headers = {'Authorization': `Bearer ${jwt}`,'Content-Type': 'application/json'}
  const response = await fetch(request, {headers: headers, method: 'PATCH', body: JSON.stringify(data)})

  return response.json()
}

