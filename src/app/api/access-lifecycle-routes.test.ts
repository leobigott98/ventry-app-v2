import { NextRequest } from "next/server";
import { beforeEach,describe,expect,it,vi } from "vitest";

import { PUT as updateInvitationRoute } from "@/app/api/invitations/[invitationId]/route";
import { POST as addGroupMembersRoute } from "@/app/api/invitation-groups/[groupId]/members/route";
import { PUT as updateEventGuestRoute } from "@/app/api/events/[eventId]/guests/[guestId]/route";
import { requireApiCommunityContext } from "@/lib/auth/api";
import { addManagedInvitationGroupMembers,updateManagedEventGuest,updateManagedInvitation } from "@/lib/domain/access-lifecycle";
import { OperationError } from "@/lib/server/operation-error";

vi.mock("@/lib/auth/api",()=>({requireApiCommunityContext:vi.fn()}));
vi.mock("@/lib/domain/access-lifecycle",()=>({addManagedInvitationGroupMembers:vi.fn(),updateManagedEventGuest:vi.fn(),updateManagedInvitation:vi.fn()}));

const key="11111111-1111-4111-8111-111111111199";
function request(url:string,method:string,body:object){return new NextRequest(url,{method,headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});}
const arrival={visitDate:"2026-09-10",arrivalWindowMode:"from_time",arrivalStart:"11:00",arrivalEndDate:null,arrivalEnd:null,plannedExitDate:null,plannedExitTime:null};

describe("access lifecycle API routes",()=>{
 beforeEach(()=>{vi.clearAllMocks();vi.mocked(requireApiCommunityContext).mockResolvedValue({sessionUser:{role:"resident",residentId:"resident-a",email:"resident@example.com"},context:{community:{id:"community-a"}}} as never);});

 it("updates an invitation through its specific endpoint and preserves the idempotency key",async()=>{vi.mocked(updateManagedInvitation).mockResolvedValue({version:2,credentialRotated:false});const response=await updateInvitationRoute(request("http://localhost/api/invitations/invitation-a","PUT",{expectedVersion:1,idempotencyKey:key,visitorName:"Dana",visitorPhone:null,residentContactId:null,accessType:"visitor",notes:null,...arrival}),{params:Promise.resolve({invitationId:"invitation-a"})});expect(response.status).toBe(200);expect(updateManagedInvitation).toHaveBeenCalledWith("community-a","invitation-a",expect.objectContaining({expectedVersion:1,idempotencyKey:key}));});

 it("adds group members atomically through the group endpoint",async()=>{vi.mocked(addManagedInvitationGroupMembers).mockResolvedValue({version:2,invitationIds:["new-a"]});const response=await addGroupMembersRoute(request("http://localhost/api/invitation-groups/group-a/members","POST",{expectedVersion:1,idempotencyKey:key,visitors:[{fullName:"Nueva Persona",phone:null,residentContactId:null}]}),{params:Promise.resolve({groupId:"group-a"})});expect(response.status).toBe(200);expect(addManagedInvitationGroupMembers).toHaveBeenCalledWith("community-a","group-a",1,[expect.objectContaining({fullName:"Nueva Persona"})],key);});

 it("updates one event guest without trusting resident or community data from the client",async()=>{vi.mocked(updateManagedEventGuest).mockResolvedValue({eventVersion:3,guestVersion:2,credentialRotated:true});const response=await updateEventGuestRoute(request("http://localhost/api/events/event-a/guests/guest-a","PUT",{expectedVersion:2,expectedGuestVersion:1,idempotencyKey:key,fullName:"Invitada Nueva",phone:null,notes:null,residentContactId:null,allowsCompanions:true,maxCompanions:2}),{params:Promise.resolve({eventId:"event-a",guestId:"guest-a"})});expect(response.status).toBe(200);expect(updateManagedEventGuest).toHaveBeenCalledWith("community-a","event-a","guest-a",expect.objectContaining({expectedVersion:2,expectedGuestVersion:1,idempotencyKey:key}));});

 it("returns 409 for optimistic concurrency conflicts",async()=>{vi.mocked(updateManagedInvitation).mockRejectedValue(new OperationError({code:"40001",message:"invitation version conflict",details:null,hint:null}));const response=await updateInvitationRoute(request("http://localhost/api/invitations/invitation-a","PUT",{expectedVersion:1,idempotencyKey:key,visitorName:"Dana",visitorPhone:null,residentContactId:null,accessType:"visitor",notes:null,...arrival}),{params:Promise.resolve({invitationId:"invitation-a"})});expect(response.status).toBe(409);expect(await response.json()).toMatchObject({code:"VERSION_CONFLICT"});});
});
