import { beforeEach, describe, expect, it, vi } from "vitest";
import { findAccessByCredential } from "@/lib/domain/event-access";
import { getEventValidationMatch } from "@/lib/domain/events";
import { createServerSupabaseClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server",()=>({createServerSupabaseClient:vi.fn()}));
vi.mock("@/lib/domain/events",()=>({getEventValidationMatch:vi.fn()}));
vi.mock("@/lib/domain/guards",()=>({getInvitationValidationMatch:vi.fn()}));
describe("individual event credential validation",()=>{beforeEach(()=>vi.clearAllMocks());
it("resolves the exact guest and does not fall back to the shared validator",async()=>{const rpc=vi.fn().mockResolvedValueOnce({data:{rateLimited:false,kind:"event",resourceId:"event-1",eventGuestId:"guest-2",status:"active",credentialRef:"ref"},error:null});vi.mocked(createServerSupabaseClient).mockResolvedValue({rpc} as never);vi.mocked(getEventValidationMatch).mockResolvedValue({kind:"event"} as never);const result=await findAccessByCredential("community-a","qr","secret","device-identifier-123456","origin");expect(rpc).toHaveBeenCalledOnce();expect(rpc).toHaveBeenCalledWith("validate_event_guest_credential",expect.objectContaining({p_community_id:"community-a"}));expect(getEventValidationMatch).toHaveBeenCalledWith("community-a","event-1","active","guest-2");expect(result.match).toEqual({kind:"event"});});
it("falls back to legacy validation only when no individual credential matches",async()=>{const rpc=vi.fn().mockResolvedValueOnce({data:null,error:null}).mockResolvedValueOnce({data:{rateLimited:false,status:"not_found",credentialRef:"attempt"},error:null});vi.mocked(createServerSupabaseClient).mockResolvedValue({rpc} as never);const result=await findAccessByCredential("community-a","pin","00000000","device-identifier-123456","origin");expect(rpc).toHaveBeenCalledTimes(2);expect(result.match).toBeNull();});});
