export function getRoleHomePath(role: string): string {
  switch (role) {
    case 'admin':   return '/admin'
    case 'owner':   return '/owner'
    case 'jockey':  return '/jockey'
    default:        return '/'
  }
}