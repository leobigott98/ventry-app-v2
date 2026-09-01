import { fireEvent,render,screen } from "@testing-library/react";
import { beforeEach,describe,expect,it,vi } from "vitest";

import { LifecycleActions } from "@/components/access/lifecycle-actions";

const refresh=vi.fn();const push=vi.fn();
vi.mock("next/navigation",()=>({useRouter:()=>({refresh,push})}));

const windowValue={date:"2026-09-10",arrivalWindowMode:"all_day" as const,arrivalStart:null,arrivalEndDate:null,arrivalEnd:null,plannedExitDate:null,plannedExitTime:null};

describe("LifecycleActions",()=>{
 beforeEach(()=>{vi.clearAllMocks();vi.stubGlobal("confirm",vi.fn(()=>true));});
 it("does not create a duplicate before explicit confirmation",()=>{const fetchSpy=vi.spyOn(globalThis,"fetch");render(<LifecycleActions kind="invitation" resourceId="invitation-a" version={1} window={windowValue}/>);expect(fetchSpy).not.toHaveBeenCalled();});
 it("blocks a double cancel submit and keeps one idempotent request",()=>{const fetchSpy=vi.spyOn(globalThis,"fetch").mockReturnValue(new Promise<Response>(()=>{}));render(<LifecycleActions kind="event" resourceId="event-a" version={3} window={windowValue}/>);const button=screen.getByRole("button",{name:"Confirmar cancelación"});fireEvent.click(button);fireEvent.click(button);expect(fetchSpy).toHaveBeenCalledTimes(1);const body=JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body));expect(body).toMatchObject({expectedVersion:3});expect(body.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/);});
});
