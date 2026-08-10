import type { SystemCommonApi } from './common';

import { requestClient } from '#/api/request';

export namespace SystemJobApi {
  export interface JobSaveReq {
    args?: string;
    concurrentGuard: number;
    cron?: string;
    executor: string;
    fixedRateSeconds?: string;
    name: string;
    timeoutSeconds?: string;
  }

  export interface JobResp {
    id: string;
    name: string;
    executor: string;
    cron?: null | string;
    fixedRateSeconds?: null | string;
    args?: string;
    timeoutSeconds?: null | string;
    concurrentGuard: number;
    status: number;
    createTime: string;
  }

  export type JobSaveData = JobSaveReq;

  export type JobLogQuery = SystemCommonApi.PageQuery;

  export interface JobLogResp {
    durationMs?: null | string;
    errorMsg?: string;
    id: string;
    jobId: string;
    jobName: string;
    manual: number;
    outcome: number;
    triggerTime: string;
  }

  export interface CronPreviewResp {
    valid: boolean;
    message: string;
    zoneId: string;
    nextExecutionTimes: string[];
  }
}

export function getJobList() {
  return requestClient.get<SystemJobApi.JobResp[]>('/system/job/list');
}

export function getJobLogList(jobId: string, params: SystemJobApi.JobLogQuery) {
  return requestClient.get<SystemCommonApi.PageResult<SystemJobApi.JobLogResp>>(
    `/system/job/log/${jobId}`,
    { params },
  );
}

export function getAllJobLogList(params: SystemJobApi.JobLogQuery) {
  return requestClient.get<SystemCommonApi.PageResult<SystemJobApi.JobLogResp>>(
    '/system/job/log',
    { params },
  );
}

export function createJob(data: SystemJobApi.JobSaveReq) {
  return requestClient.post('/system/job', data);
}

export function updateJob(id: string, data: SystemJobApi.JobSaveReq) {
  return requestClient.put(`/system/job/${id}`, data);
}

export function previewJobCron(cron: string) {
  return requestClient.post<SystemJobApi.CronPreviewResp>(
    '/system/job/cron/preview',
    { cron },
  );
}

export function deleteJob(id: string) {
  return requestClient.delete(`/system/job/${id}`);
}

export function startJob(id: string) {
  return requestClient.post(`/system/job/${id}/start`);
}

export function stopJob(id: string) {
  return requestClient.post(`/system/job/${id}/stop`);
}

export function runJob(id: string) {
  return requestClient.post(`/system/job/${id}/run`);
}
