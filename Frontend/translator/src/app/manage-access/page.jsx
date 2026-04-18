/* Copyright 2024 Centro Nacional de Inteligencia Artificial (CENIA, Chile). All rights reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

     http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License. */
"use client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faUserPlus,
  faSpinner,
  faEnvelope,
  faUserMinus,
  faUserCheck,
  faTrash,
  faCircleInfo,
} from "@fortawesome/free-solid-svg-icons";
import { useEffect, useState, useContext, useCallback } from "react";
import { AuthContext } from "../contexts";
import { Skeleton } from "@/components/ui/skeleton";
import api from "../api";
import { API_ENDPOINTS, REQUEST_ACCESS_REASONS , ROLES} from "../constants";
import ActionIcon from "../components/actionIcon/actionIcon";
import ActionButton from "../components/actionButton/actionButton";

export default function Manageaccess() {

  const roles = ROLES;

  const [users, setUsers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [requests, setRequests] = useState([]);
  const currentUser = useContext(AuthContext);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isTableLoading, setIsTableLoading] = useState(true);
  const { toast } = useToast();
  const [newInvite, setNewInvite] = useState({
    first_name: "",
    last_name: "",
    email: "",
    organization: "",
    role: "",
  });
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [selectedReason, setSelectedReason] = useState("");
  const [userOptions, setUserOptions] = useState([]);

  const [menuState, setMenuState] = useState(false);

  const closeMenu = () => {
    setMenuState(false);
  };

  const fetchData = async (endpoint, setter, errorMessage) => {
    try {
      const res = await api.get(endpoint);
      setter(res.data);
    } catch (error) {
      console.error(`${errorMessage}: ${error.message}`);
    }
  };

  const getInvitations = useCallback(() =>
    fetchData(
      API_ENDPOINTS.INVITATIONS,
      setInvitations,
        "Error fetching invitations"
      ),
    []
  );

  const getUsers = useCallback(() =>
    fetchData(
      API_ENDPOINTS.USERS,
      setUsers,
      "Error fetching users"
    ),
    []
  );

  const getRequests = useCallback(() =>
    fetchData(
      API_ENDPOINTS.PENDING_REQUESTS,
      setRequests,
      "Error fetching requests"
    ),
    []
  );

  useEffect(() => {
    setIsTableLoading(true);
    const fetchAllData = async () => {
      await Promise.all([getInvitations(), getRequests(), getUsers()]);
      setIsTableLoading(false);
    };

    fetchAllData();
  }, [getInvitations, getRequests, getUsers]);

  const handleSendInvite = async () => {
    setIsSendingInvite(true);
    await sendInvite(
      newInvite.email,
      newInvite.role,
      newInvite.first_name,
      newInvite.last_name,
      newInvite.organization
    );
    setNewInvite({
      first_name: "",
      last_name: "",
      email: "",
      role: "",
      organization: "",
    });
    setIsInviteModalOpen(false);
    setIsSendingInvite(false);
  };

  const sendInvite = async (email, role, firstName, lastName, organization) => {
    try {
      const res = await api.post(API_ENDPOINTS.SEND_INVITATION, {
        email: email,
        role: role,
        first_name: firstName,
        last_name: lastName,
        organization: organization,
      });
      toast({
        title: "Invitación enviada",
        description: `La invitación ha sido enviada correctamente al usuario ${email}`,
      });
      await getInvitations();
    } catch (error) {
      console.log("Error sending invite");
    }
  };

  const handleResendInvitation = async (invitationId, email) => {
    try {
      const res = await api.post(
        `${API_ENDPOINTS.INVITATIONS}${invitationId}/resend_invitation/`
      );
      console.log("Invitation sent");
      toast({
        title: "Invitación reenviada",
        description: `La invitación ha sido reenviada correctamente al usuario ${email}`,
      });
    } catch (error) {
      console.log("Error resending invitation");
    }
  };

  const handleDeleteInvitation = async (invitationId, email) => {
    try {
      const res = await api.delete(
        `${API_ENDPOINTS.INVITATIONS}${invitationId}/`
      );
      setInvitations(
        invitations.filter((invite) => invite.id !== invitationId)
      );
      toast({
        title: "Invitación eliminada",
        description: `La invitación del usuario ${email} ha sido eliminada correctamente`,
      });
    } catch (error) {
      console.log("Error deleting invitation");
    }
  };

  const handleAcceptRequest = async (requestId, approved, request) => {
    try {
      const res_request = await api.patch(
        `${API_ENDPOINTS.REQUESTS}${requestId}/`,
        { approved: approved }
      );
      setRequests(requests.filter((request) => request.id !== requestId));
      if (approved) {
        await sendInvite(
          request.email,
          request.role,
          request.first_name,
          request.last_name,
          request.organization
        ); // send new invitation
        await getInvitations();
      }
      toast({
        title: approved ? "Solicitud aceptada" : "Solicitud rechazada",
        description: `La solicitud del usuario ${request.email} ha sido actualizada correctamente`,
      });
    } catch (error) {
      console.log("Error accepting request");
    }
  };

  const handleUserRoleChange = async (userId, newRole) => {
    try {
      const res = await api.patch(
        `${API_ENDPOINTS.USERS}${userId}/update_user_role/`,
        { role: newRole }
      );
      setUsers(
        users.map((user) =>
          user.id === userId
            ? { ...user, profile: { ...user.profile, role: newRole } }
            : user
        )
      );
      toast({
        title: "Rol actualizado",
        description: `El rol del usuario ha sido actualizado correctamente a ${newRole}`,
      });
    } catch (error) {
      console.log("Error updating user role");
    }
  };

  const handleInvitationRoleChange = async (invitationId, newRole) => {
    try {
      const res = await api.patch(
        `${API_ENDPOINTS.INVITATIONS}${invitationId}/`,
        { role: newRole }
      );
      setInvitations(
        invitations.map((invitation) =>
          invitation.id === invitationId
            ? { ...invitation, role: newRole }
            : invitation
        )
      );
      toast({
        title: "Rol actualizado",
        description: `El rol del usuario ha sido actualizado correctamente a ${newRole}`,
      });
    } catch (error) {
      console.log("Error updating invitation role");
    }
  };

  const handleRequestRoleChange = async (requestId, newRole) => {
    try {
      setRequests(
        requests.map((request) =>
          request.id === requestId ? { ...request, role: newRole } : request
        )
      );
      toast({
        title: "Rol actualizado",
      });
    } catch (error) {
      console.log("Error updating request role");
    }
  };

  const handleDisableUser = async (userId, email) => {
    try {
      const res = await api.patch(
        `${API_ENDPOINTS.USERS}${userId}/change_status/`,
        { is_active: false }
      );
      setUsers(users.filter((user) => user.id !== userId));
      toast({
        title: "Usuario eliminado",
        description: `El usuario ${email} ha sido eliminado correctamente`,
      });
    } catch (error) {
      console.log("Error disabling user");
    }
  };

  return (
    <div className="h-fit min-h-screen bg-gray-100 w-full">
      <div className="container grow mx-auto w-[90%] p-4">
        <h1 className="text-3xl font-bold mb-6 text-default">
          Administrar Accesos
        </h1>
        <Card className="mb-6">
          <CardContent className="flex items-center justify-between py-6">
            <div className="flex items-center space-x-4">
              <Avatar className="h-12 w-12">
                <AvatarImage
                  src={currentUser.profile.avatar}
                  alt={currentUser.first_name + " " + currentUser.last_name}
                />
                <AvatarFallback>
                  {currentUser.first_name[0] + currentUser.last_name[0]}
                </AvatarFallback>
              </Avatar>
              <div>
                <h2 className="text-2xl font-bold">
                  {currentUser.first_name + " " + currentUser.last_name}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {currentUser.email}
                </p>
                <p className="text-sm font-medium text-default">
                  {roles.find(role => role.value === currentUser.profile.role).name}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Tabs defaultValue="users" className="space-y-4">
          <TabsList className="mb-4 py-10">
            <TabsTrigger value="users" className="text-lg font-semibold">
              Usuarios Activos
            </TabsTrigger>
            <TabsTrigger value="invitations" className="text-lg font-semibold">
              Invitaciones Activas
            </TabsTrigger>
            <TabsTrigger value="requests" className="text-lg font-semibold">
              Solicitudes de Acceso Pendientes
            </TabsTrigger>
          </TabsList>
          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl font-semibold">
                  Usuarios Activos
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isTableLoading
                  ? [...Array(5)].map((_, index) => (
                      <div
                        key={index}
                        className="flex items-center space-x-4 mb-4"
                      >
                        <Skeleton className="h-12 w-12 rounded-full" />
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-[250px]" />
                          <Skeleton className="h-4 w-[200px]" />
                        </div>
                      </div>
                    ))
                  : users.map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center justify-between py-4 border-b last:border-b-0"
                      >
                        <div className="flex items-center space-x-4">
                          <Avatar>
                            <AvatarImage
                              src={user.profile.avatar}
                              alt={user.username}
                            />
                            <AvatarFallback>
                              {[user.first_name[0], user.last_name[0]].join("")}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">
                              {user.first_name + " " + user.last_name}{" "}
                              {currentUser.username === user.username
                                ? "(Tú)"
                                : ""}
                            </p>
                            <p className="text-sm text-gray-500">
                              {user.email}
                            </p>
                            <p className="text-sm text-gray-500">
                              {user.organization}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Select
                            onValueChange={(newRole) =>
                              handleUserRoleChange(user.id, newRole)
                            }
                            defaultValue={roles.find(role => role.value === user.profile.role).value}
                          >
                            <SelectTrigger className="w-[160px]">
                              <SelectValue placeholder="Seleccionar Rol" />
                            </SelectTrigger>
                            <SelectContent>
                              {roles.map((role) => (
                                <SelectItem value={role.value} key={role.value}>
                                  {role.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <ActionIcon
                            icon={faUserMinus}
                            tooltipText="Eliminar Usuario"
                            clickCallback={() =>
                              handleDisableUser(user.id, user.email)
                            }
                            variant="destructive"
                          />
                        </div>
                      </div>
                    ))}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="invitations">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-2xl font-semibold">
                  Invitaciones Activas
                </CardTitle>
                <Dialog
                  open={isInviteModalOpen}
                  onOpenChange={setIsInviteModalOpen}
                >
                  <DialogTrigger asChild>
                    <ActionButton
                      icon={faUserPlus}
                      tooltipText="Nueva Invitación"
                      clickCallback={() => setIsInviteModalOpen(true)}
                    />
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Enviar Nueva Invitación</DialogTitle>
                      <DialogDescription>
                        Llena los detalles para enviar una nueva invitación.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="firstName" className="text-right">
                          Nombre
                        </Label>
                        <Input
                          id="firstName"
                          value={newInvite.first_name}
                          onChange={(e) =>
                            setNewInvite({
                              ...newInvite,
                              first_name: e.target.value,
                            })
                          }
                          className="col-span-3"
                        />
                        <Label htmlFor="lastName" className="text-right">
                          Apellido
                        </Label>
                        <Input
                          id="lastName"
                          value={newInvite.last_name}
                          onChange={(e) =>
                            setNewInvite({
                              ...newInvite,
                              last_name: e.target.value,
                            })
                          }
                          className="col-span-3"
                        />
                        <Label htmlFor="email" className="text-right">
                          Correo
                        </Label>
                        <Input
                          id="email"
                          type="email"
                          value={newInvite.email}
                          onChange={(e) =>
                            setNewInvite({
                              ...newInvite,
                              email: e.target.value,
                            })
                          }
                          className="col-span-3"
                        />
                        <Label htmlFor="organization" className="text-right">
                          Organización
                        </Label>
                        <Input
                          id="organization"
                          type="text"
                          value={newInvite.organization}
                          onChange={(e) =>
                            setNewInvite({
                              ...newInvite,
                              organization: e.target.value,
                            })
                          }
                          className="col-span-3"
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="role" className="text-right">
                          Rol
                        </Label>
                        <Select
                          defaultValue={roles.find(role => role.value === newInvite.role)}
                          onValueChange={(value) =>
                            setNewInvite({ ...newInvite, role: value })
                          }
                        >
                          <SelectTrigger className="col-span-3">
                            <SelectValue placeholder="Seleccionar Rol" />
                          </SelectTrigger>
                          <SelectContent>
                            {roles.map((role) => (
                              <SelectItem value={role.value} key={role.value}>
                                {role.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <ActionButton
                        clickCallback={handleSendInvite}
                        disabled={isSendingInvite}
                      >
                        Enviar Invitación
                      </ActionButton>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {invitations.map((invite) => (
                  <div
                    key={invite.id}
                    className="flex items-center justify-between py-4 border-b last:border-b-0"
                  >
                    <div className="flex items-center space-x-4">
                      <Avatar>
                        <AvatarImage />
                        <AvatarFallback>
                          {invite.first_name
                            ? [invite.first_name[0], invite.last_name[0]].join(
                                ""
                              )
                            : invite.email[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        {invite.first_name && invite.last_name ? (
                          <p className="font-medium">
                            {invite.first_name + " " + invite.last_name}
                          </p>
                        ) : (
                          <p className="font-medium">{invite.email}</p>
                        )}
                        <p className="text-sm text-gray-500">{invite.email}</p>
                        <p className="text-sm text-gray-500">
                          Invitado por: {invite.invited_by.email}
                        </p>
                        <p className="text-sm text-gray-500">
                          {invite.organization}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Select
                        onValueChange={(newRole) =>
                          handleInvitationRoleChange(invite.id, newRole)
                        }
                        defaultValue={roles.find(role => role.value === invite.role).value}
                      >
                        <SelectTrigger className="w-[160px]">
                          <SelectValue placeholder=" Rol" />
                        </SelectTrigger>
                        <SelectContent>
                          {roles.map((role) => (
                            <SelectItem value={role.value} key={role.value}>
                              {role.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <ActionIcon
                        icon={faEnvelope}
                        tooltipText="Reenviar Invitación"
                        clickCallback={() =>
                          handleResendInvitation(invite.id, invite.email)
                        }
                        variant="outline"
                      />
                      <ActionIcon
                        icon={faTrash}
                        tooltipText="Eliminar Invitación"
                        clickCallback={() =>
                          handleDeleteInvitation(invite.id, invite.email)
                        }
                        variant="destructive"
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="requests">
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl font-semibold">
                  Solicitudes de Acceso Pendientes
                </CardTitle>
              </CardHeader>
              <CardContent>
                {requests.map((request) => (
                  <div
                    key={request.id}
                    className="flex items-center justify-between py-4 border-b last:border-b-0"
                  >
                    <div className="flex items-center space-x-4">
                      <Avatar>
                        <AvatarImage alt={request.username} />
                        <AvatarFallback>
                          {[request.first_name[0], request.last_name[0]].join(
                            ""
                          )}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">
                          {request.first_name + " " + request.last_name}
                        </p>
                        <p className="text-sm text-gray-500">{request.email}</p>
                        <p className="text-sm text-gray-500">
                          {REQUEST_ACCESS_REASONS.find(reason => reason.value === request.reason)?.name} {request.organization ? `(${request.organization})` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      
                      <Select
                        onValueChange={(newRole) =>
                          handleRequestRoleChange(request.id, newRole)
                        }
                        defaultValue={request.role? roles.find(role => role.value === request.role).value : "User"}
                      >
                        <SelectTrigger className="w-[160px]">
                          <SelectValue placeholder="Rol" />
                        </SelectTrigger>
                        <SelectContent>
                          {roles.map((role) => (
                            <SelectItem value={role.value} key={role.value}>
                              {role.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <ActionIcon
                        icon={faUserCheck}
                        tooltipText="Dar acceso"
                        clickCallback={() =>
                          handleAcceptRequest(request.id, true, request)
                        }
                        variant="outline"
                      />
                      <ActionIcon
                        icon={faUserMinus}
                        tooltipText="Rechazar acceso"
                        clickCallback={() =>
                          handleAcceptRequest(request.id, false)
                        }
                        variant="destructive"
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog
          open={!!selectedReason}
          onOpenChange={() => setSelectedReason("")}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Razón para solicitar acceso</DialogTitle>
            </DialogHeader>
            <p>{selectedReason}</p>
            <DialogFooter>
              <Button
                onClick={() => setSelectedReason("")}
                style={{ backgroundColor: "#0a8bdb", color: "white" }}
              >
                Cerrar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
