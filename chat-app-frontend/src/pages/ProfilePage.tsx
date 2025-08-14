import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppContext } from '@/types/app-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

// Import User type from shared type definitions
// import { User } from '@/types/user'

const ProfilePage: React.FC = () => {
  const { currentUser, setCurrentUser, backendUrl, getToken, setToken } =
    useAppContext()
  const navigate = useNavigate()
  const [newUsername, setNewUsername] = useState(currentUser?.username || '')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  // Initialize local state from currentUser
  useEffect(() => {
    if (currentUser) {
      setNewUsername(currentUser.username)
    }
  }, [currentUser])

  const handleUpdateProfile = async () => {
    if (!currentUser) return

    if (newUsername.trim() === '') {
      setError('Please enter a username.')
      setMessage('')
      return
    }
    if (newUsername === currentUser.username) {
      setMessage('No changes to save.')
      setError('')
      return
    }
    if (currentUser.isGuest) {
      setError('Guest users cannot change their username.')
      setMessage('')
      return
    }

    try {
      const token = getToken()
      if (!token) {
        setError('Authentication token not found.')
        return
      }

      const updateData = {
        username: newUsername,
      }

      const res = await fetch(`${backendUrl}/api/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`, // Include JWT in Authorization header
        },
        body: JSON.stringify(updateData),
      })

      if (res.ok) {
        const data = await res.json()
        setCurrentUser(data.user) // Update global state
        setToken(data.token) // Receive and save new JWT token (due to user info change)
        setMessage('Profile updated successfully!')
        setError('')
      } else {
        const errorData = await res.json()
        setError(`Update failed: ${errorData.message}`)
        setMessage('')
      }
    } catch (err) {
      console.error('Profile update request failed:', err)
      setError('Could not connect to the server.')
      setMessage('')
    }
  }

  if (!currentUser) {
    return (
      <div className='flex items-center justify-center min-h-screen bg-background text-lg font-medium '>
        Authenticating...
      </div>
    )
  }

  return (
    <div className='flex items-center justify-center min-h-screen '>
      <div className='bg-card p-8 rounded-lg shadow-lg w-full max-w-md'>
        <h2 className='text-2xl font-bold mb-6 text-center '>
          Profile Settings
        </h2>
        {message && (
          <p className='text-green-500 text-center mb-4'>{message}</p>
        )}
        {error && <p className='text-destructive text-center mb-4'>{error}</p>}

        <div className='mb-4'>
          <label
            htmlFor='currentUsername'
            className='block text-sm font-bold mb-2'
          >
            Current Username:
          </label>
          <p id='currentUsername' className='text-lg font-semibold'>
            {currentUser.username} {currentUser.isGuest && '(Guest)'}
          </p>
        </div>

        <div className='mb-6'>
          <label htmlFor='newUsername' className='block text-sm font-bold mb-2'>
            New Username:
          </label>
          <Input
            type='text'
            id='newUsername'
            className='w-full'
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
            disabled={currentUser.isGuest} // Disable for guest users
          />
          {currentUser.isGuest && (
            <p className='text-sm text-muted-foreground mt-1'>
              Guest users cannot change their username.
            </p>
          )}
        </div>

        <Button
          onClick={handleUpdateProfile}
          className={`w-full mb-3 ${
            currentUser.isGuest ? 'opacity-50 cursor-not-allowed' : ''
          }`}
          disabled={currentUser.isGuest || !newUsername.trim()} // Disable if username is empty
        >
          Update Profile
        </Button>
        <Button onClick={() => navigate('/chat')} className='w-full'>
          Back to Chat
        </Button>
      </div>
    </div>
  )
}

export default ProfilePage
