export function buildAuthFromResponse(data) {
  if (!data?.token || !data?.user) {
    throw new Error('The server did not return a valid login session.')
  }

  const user = data.user

  return {
    token: data.token,
    user: {
      id: user.id || user._id,
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      username: user.username || user.email || '',
      email: user.email || '',
      phone: user.phone || '',
      birthday: user.birthday || '',
      role: user.role || 'member',
      avatarUrl: user.avatarUrl || '',
    },
  }
}
