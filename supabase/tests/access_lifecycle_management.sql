-- Run only against a disposable local database after all migrations.
begin;

insert into public.communities(id,name,address,location_label,planned_unit_count,access_policy_mode,gate_operation_mode,admin_contact_name,admin_contact_phone,created_by_email,time_zone)
values('71000000-0000-4000-8000-000000000001','Lifecycle A','A','A',2,'invitation_only','24_7_guarded','Admin','+58001','lifecycle@example.com','America/Caracas'),
('72000000-0000-4000-8000-000000000001','Lifecycle B','B','B',2,'invitation_only','24_7_guarded','Admin','+58002','other@example.com','America/Caracas');
insert into public.residents(id,community_id,full_name,phone) values
('71000000-0000-4000-8000-000000000101','71000000-0000-4000-8000-000000000001','Resident A','+58101'),
('72000000-0000-4000-8000-000000000101','72000000-0000-4000-8000-000000000001','Resident B','+58201');
insert into public.community_memberships(id,community_id,email,full_name,role,resident_id,auth_user_id,is_active)
values('71000000-0000-4000-8000-000000001001','71000000-0000-4000-8000-000000000001','lifecycle@example.com','Resident A','resident','71000000-0000-4000-8000-000000000101','d1000000-0000-4000-8000-000000000001',true);

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"d1000000-0000-4000-8000-000000000001","role":"authenticated","email":"lifecycle@example.com"}',true);

do $$
declare v_date date:=(now() at time zone 'America/Caracas')::date+2; v_inv uuid; v_group jsonb; v_event uuid; v_guest uuid;
  v_old_audit text; v_new_audit text; v_old_token text; v_result jsonb; v_version integer;
begin
  v_inv:=public.create_arrival_invitation('71000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000101',null,'Dana','+580001','visitor',v_date,'from_time','11:00',null,null,null,null,null,'pin','71000000-0000-4000-8000-000000008001');
  v_old_audit:=public.get_invitation_credential(v_inv)->>'credential_audit_id';
  v_result:=public.update_managed_invitation('71000000-0000-4000-8000-000000000001',v_inv,1,jsonb_build_object('visitorName','Dana','visitorPhone','+580001','residentContactId',null,'accessType','visitor','visitDate',v_date,'arrivalWindowMode','from_time','arrivalStart','12:00','arrivalEndDate',null,'arrivalEnd',null,'plannedExitDate',null,'plannedExitTime',null,'notes','Horario cambiado'),'71000000-0000-4000-8000-000000008002');
  v_new_audit:=public.get_invitation_credential(v_inv)->>'credential_audit_id';
  if v_old_audit<>v_new_audit or (v_result->>'credentialRotated')::boolean then raise exception 'schedule-only edit rotated the credential'; end if;
  select share_token into v_old_token from public.invitations where id=v_inv;
  v_result:=public.update_managed_invitation('71000000-0000-4000-8000-000000000001',v_inv,2,jsonb_build_object('visitorName','Dana Nueva','visitorPhone','+580002','residentContactId',null,'accessType','visitor','visitDate',v_date,'arrivalWindowMode','from_time','arrivalStart','12:00','arrivalEndDate',null,'arrivalEnd',null,'plannedExitDate',null,'plannedExitTime',null,'notes','Horario cambiado'),'71000000-0000-4000-8000-000000008003');
  v_new_audit:=public.get_invitation_credential(v_inv)->>'credential_audit_id';
  if v_old_audit=v_new_audit or not (v_result->>'credentialRotated')::boolean then raise exception 'identity edit did not rotate credential'; end if;
  if public.get_public_invitation(v_old_token)->>'status'<>'credential_revoked' then raise exception 'old public invitation link exposed current access'; end if;
  v_result:=public.duplicate_managed_invitation('71000000-0000-4000-8000-000000000001',v_inv,3,jsonb_build_object('visitDate',v_date+1,'arrivalWindowMode','all_day','arrivalStart',null,'arrivalEndDate',null,'arrivalEnd',null,'plannedExitDate',null,'plannedExitTime',null),'71000000-0000-4000-8000-000000008005');
  if v_result->>'redirectTo' not like '/app/invitations/%' then raise exception 'invitation duplicate did not return its detail'; end if;
  begin perform public.update_managed_invitation('71000000-0000-4000-8000-000000000001',v_inv,2,'{}','71000000-0000-4000-8000-000000008004');raise exception 'stale update was accepted';exception when sqlstate '40001' then null;end;

  v_group:=public.create_arrival_invitation_group('71000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000101','visitor',v_date,'all_day',null,null,null,null,null,null,'pin','[{"fullName":"Ana"},{"fullName":"Beto"}]','71000000-0000-4000-8000-000000008010');
  v_result:=public.add_managed_invitation_group_members('71000000-0000-4000-8000-000000000001',(v_group->>'groupId')::uuid,1,'[{"fullName":"Carla"}]','71000000-0000-4000-8000-000000008011');
  if jsonb_array_length(v_result->'invitationIds')<>1 then raise exception 'group add did not return one member'; end if;
  if public.add_managed_invitation_group_members('71000000-0000-4000-8000-000000000001',(v_group->>'groupId')::uuid,1,'[{"fullName":"Carla"}]','71000000-0000-4000-8000-000000008011')<>v_result then raise exception 'group add retry was not idempotent'; end if;
  v_result:=public.duplicate_managed_invitation_group('71000000-0000-4000-8000-000000000001',(v_group->>'groupId')::uuid,2,jsonb_build_object('visitDate',v_date+1,'arrivalWindowMode','all_day','arrivalStart',null,'arrivalEndDate',null,'arrivalEnd',null,'plannedExitDate',null,'plannedExitTime',null),'71000000-0000-4000-8000-000000008012');
  if v_result->>'redirectTo' not like '/app/invitation-groups/%' then raise exception 'group duplicate did not return its detail'; end if;

  v_event:=public.create_arrival_resident_event('71000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000101','Event',v_date,'all_day',null,null,null,null,null,null,'qr','[{"fullName":"Guest","allowsCompanions":false,"maxCompanions":0}]','71000000-0000-4000-8000-000000008020');
  select id into v_guest from public.event_guests where event_id=v_event;
  select item->>'credential_audit_id' into v_old_audit from jsonb_array_elements(public.get_event_guest_credentials(v_event)) item where item->>'event_guest_id'=v_guest::text;
  v_result:=public.update_managed_event_guest('71000000-0000-4000-8000-000000000001',v_event,v_guest,1,1,jsonb_build_object('fullName','Guest Renamed','phone',null,'notes',null,'residentContactId',null,'allowsCompanions',true,'maxCompanions',2),'71000000-0000-4000-8000-000000008021');
  select item->>'credential_audit_id' into v_new_audit from jsonb_array_elements(public.get_event_guest_credentials(v_event)) item where item->>'event_guest_id'=v_guest::text;
  if v_old_audit=v_new_audit or not(v_result->>'credentialRotated')::boolean then raise exception 'event guest identity did not rotate credential';end if;
  v_version:=(v_result->>'eventVersion')::integer;
  v_result:=public.duplicate_managed_resident_event('71000000-0000-4000-8000-000000000001',v_event,v_version,jsonb_build_object('eventDate',v_date+1,'arrivalWindowMode','all_day','arrivalStart',null,'arrivalEndDate',null,'arrivalEnd',null,'plannedExitDate',null,'plannedExitTime',null),'71000000-0000-4000-8000-000000008024');
  if v_result->>'redirectTo' not like '/app/events/%' then raise exception 'event duplicate did not return its detail'; end if;
  v_result:=public.cancel_managed_resident_event('71000000-0000-4000-8000-000000000001',v_event,v_version,'cancelled','71000000-0000-4000-8000-000000008022');
  if public.cancel_managed_resident_event('71000000-0000-4000-8000-000000000001',v_event,v_version,'cancelled','71000000-0000-4000-8000-000000008022')<>v_result then raise exception 'event cancellation retry was not idempotent';end if;
  if public.get_access_change_history('71000000-0000-4000-8000-000000000001','invitation',v_inv)::text~*'(credential_value|secret_value|qr_payload)' or public.get_access_change_history('71000000-0000-4000-8000-000000000001','event',v_event)::text~*'(credential_value|secret_value|qr_payload)' then raise exception 'audit contains credential material';end if;
  begin perform public.cancel_managed_resident_event('72000000-0000-4000-8000-000000000001',v_event,v_version,null,'71000000-0000-4000-8000-000000008023');raise exception 'cross-community mutation was accepted';exception when sqlstate 'P0002' then null;end;
end $$;

rollback;
