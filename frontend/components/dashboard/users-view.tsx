"use client"

import { useState, useEffect } from "react"
import { Plus, Search, MoreVertical, UserCheck, UserX, Lock, Trash2, Edit, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { apiClient, ApiError } from "@/lib/api/client"
import { useToast } from "@/hooks/use-toast"
import { usePermission } from "@/lib/auth/permissions"

interface User {
  id: string
  email: string
  username: string
  firstName: string | null
  lastName: string | null
  isActive: boolean
  mfaEnabled: boolean
  role: {
    id: string
    name: string
    displayName: string
  }
  createdAt: string
  lastLoginAt: string | null
}

interface Role {
  id: string
  name: string
  displayName: string
  description: string | null
  userCount: number
}

export function UsersView() {
  const { toast } = useToast()
  
  // Permission checks
  const canCreate = usePermission('users', 'create')
  const canUpdate = usePermission('users', 'update')
  const canDelete = usePermission('users', 'delete')
  
  const [users, setUsers] = useState<User[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedRole, setSelectedRole] = useState<string>("all")
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showRoleDialog, setShowRoleDialog] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [newRoleId, setNewRoleId] = useState("")
  const [showTempPassword, setShowTempPassword] = useState<string | null>(null)
  const [createForm, setCreateForm] = useState({
    email: "",
    username: "",
    firstName: "",
    lastName: "",
    roleId: "",
  })

  // Load users and roles
  const loadData = async () => {
    setIsLoading(true)
    try {
      const [usersResponse, rolesResponse] = await Promise.all([
        apiClient.getUsers({ 
          search: searchQuery || undefined,
          roleId: selectedRole !== "all" ? selectedRole : undefined,
        }),
        apiClient.getRoles(),
      ])
      setUsers(usersResponse.data || [])
      setRoles(rolesResponse.data || [])
    } catch (error) {
      if (error instanceof ApiError) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        })
      }
      // Set empty arrays on error
      setUsers([])
      setRoles([])
    } finally {
      setIsLoading(false)
    }
  }

  // Load data on mount
  useEffect(() => {
    loadData()
  }, [])

  // Create user
  const handleCreateUser = async () => {
    // Validate required fields
    if (!createForm.email || !createForm.username || !createForm.roleId) {
      toast({
        title: "Validation Error",
        description: "Email, username, and role are required",
        variant: "destructive",
      })
      return
    }

    try {
      const response = await apiClient.createUser(createForm)
      setShowTempPassword(response.temporaryPassword)
      setShowCreateDialog(false)
      setCreateForm({
        email: "",
        username: "",
        firstName: "",
        lastName: "",
        roleId: "",
      })
      loadData()
      toast({
        title: "Success",
        description: "User created successfully",
      })
    } catch (error) {
      if (error instanceof ApiError) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        })
      }
    }
  }

  // Activate user
  const handleActivate = async (userId: string) => {
    try {
      await apiClient.activateUser(userId)
      loadData()
      toast({
        title: "Success",
        description: "User activated successfully",
      })
    } catch (error) {
      if (error instanceof ApiError) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        })
      }
    }
  }

  // Deactivate user
  const handleDeactivate = async (userId: string) => {
    try {
      await apiClient.deactivateUser(userId)
      loadData()
      toast({
        title: "Success",
        description: "User deactivated successfully",
      })
    } catch (error) {
      if (error instanceof ApiError) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        })
      }
    }
  }

  // Unlock user
  const handleUnlock = async (userId: string) => {
    try {
      await apiClient.unlockUser(userId)
      loadData()
      toast({
        title: "Success",
        description: "User unlocked successfully",
      })
    } catch (error) {
      if (error instanceof ApiError) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        })
      }
    }
  }

  // Open role assignment dialog
  const handleOpenRoleDialog = (user: User) => {
    setSelectedUser(user)
    setNewRoleId(user.role.id)
    setShowRoleDialog(true)
  }

  // Assign role to user
  const handleAssignRole = async () => {
    if (!selectedUser || !newRoleId) return

    try {
      await apiClient.assignRole(selectedUser.id, newRoleId)
      loadData()
      setShowRoleDialog(false)
      setSelectedUser(null)
      setNewRoleId("")
      toast({
        title: "Success",
        description: "User role updated successfully. User must log in again.",
      })
    } catch (error) {
      if (error instanceof ApiError) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        })
      }
    }
  }

  // Delete user
  const handleDelete = async (userId: string) => {
    if (!confirm("Are you sure you want to delete this user?")) return
    
    try {
      await apiClient.deleteUser(userId)
      loadData()
      toast({
        title: "Success",
        description: "User deleted successfully",
      })
    } catch (error) {
      if (error instanceof ApiError) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        })
      }
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Users</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage user accounts and permissions
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create User
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="flex-1">
          <Input
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-sm"
          />
        </div>
        <Select value={selectedRole} onValueChange={setSelectedRole}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            {roles.map((role) => (
              <SelectItem key={role.id} value={role.id}>
                {role.displayName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={loadData}>
          <Search className="mr-2 h-4 w-4" />
          Search
        </Button>
      </div>

      {/* Users Table */}
      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>MFA</TableHead>
              <TableHead>Last Login</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Loading users...
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No users found
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium text-foreground">{user.username}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                      {user.firstName && user.lastName && (
                        <p className="text-xs text-muted-foreground">
                          {user.firstName} {user.lastName}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="gap-1">
                      <Shield className="h-3 w-3" />
                      {user.role.displayName}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {user.isActive ? (
                      <Badge variant="default" className="bg-success">Active</Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {user.mfaEnabled ? (
                      <Badge variant="default">Enabled</Badge>
                    ) : (
                      <Badge variant="outline">Disabled</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {user.lastLoginAt
                      ? new Date(user.lastLoginAt).toLocaleDateString()
                      : "Never"}
                  </TableCell>
                  <TableCell className="text-right">
                    {(canUpdate || canDelete) && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {canUpdate && (
                            <>
                              <DropdownMenuItem>
                                <Edit className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleOpenRoleDialog(user)}>
                                <Shield className="mr-2 h-4 w-4" />
                                Change Role
                              </DropdownMenuItem>
                              {user.isActive ? (
                                <DropdownMenuItem onClick={() => handleDeactivate(user.id)}>
                                  <UserX className="mr-2 h-4 w-4" />
                                  Deactivate
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem onClick={() => handleActivate(user.id)}>
                                  <UserCheck className="mr-2 h-4 w-4" />
                                  Activate
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => handleUnlock(user.id)}>
                                <Lock className="mr-2 h-4 w-4" />
                                Unlock Account
                              </DropdownMenuItem>
                            </>
                          )}
                          {canUpdate && canDelete && <DropdownMenuSeparator />}
                          {canDelete && (
                            <DropdownMenuItem
                              onClick={() => handleDelete(user.id)}
                              className="text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create User Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
            <DialogDescription>
              Add a new user to the system. A temporary password will be generated.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={createForm.email}
                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                placeholder="user@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">Username *</Label>
              <Input
                id="username"
                value={createForm.username}
                onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
                placeholder="johndoe"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  value={createForm.firstName}
                  onChange={(e) => setCreateForm({ ...createForm, firstName: e.target.value })}
                  placeholder="John"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={createForm.lastName}
                  onChange={(e) => setCreateForm({ ...createForm, lastName: e.target.value })}
                  placeholder="Doe"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role *</Label>
              <Select
                value={createForm.roleId}
                onValueChange={(value) => setCreateForm({ ...createForm, roleId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateUser}
              disabled={!createForm.email || !createForm.username || !createForm.roleId}
            >
              Create User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Temporary Password Dialog */}
      <Dialog open={!!showTempPassword} onOpenChange={() => setShowTempPassword(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>User Created Successfully</DialogTitle>
            <DialogDescription>
              Save this temporary password. It will only be shown once.
            </DialogDescription>
          </DialogHeader>
          <Alert>
            <AlertDescription className="font-mono text-sm">
              {showTempPassword}
            </AlertDescription>
          </Alert>
          <DialogFooter>
            <Button onClick={() => setShowTempPassword(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Role Assignment Dialog */}
      <Dialog open={showRoleDialog} onOpenChange={setShowRoleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change User Role</DialogTitle>
            <DialogDescription>
              Assign a new role to {selectedUser?.username}. The user will need to log in again for changes to take effect.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Current Role</Label>
              <div className="p-2 bg-muted rounded-md">
                <Badge variant="outline">{selectedUser?.role.displayName}</Badge>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-role">New Role</Label>
              <Select value={newRoleId} onValueChange={setNewRoleId}>
                <SelectTrigger id="new-role">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Alert>
              <AlertDescription>
                <strong>Note:</strong> All active sessions for this user will be terminated and they will need to log in again.
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRoleDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAssignRole} disabled={!newRoleId || newRoleId === selectedUser?.role.id}>
              Assign Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
