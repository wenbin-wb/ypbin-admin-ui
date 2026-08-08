import { requestClient } from '#/api/request';

export namespace SystemJobApi {
  export interface JobResp {
    id: string;
    name: string;
    executor: string;
    cron: string;
    fixedRateSeconds?: number;
    args?: string;
    timeoutSeconds: number;
    concurrentGuard: number;
    status: number;
    createTime: string;
  }

  export type JobSaveData = Pick<
    JobResp,
    | 'args'
    | 'concurrentGuard'
    | 'cron'
    | 'executor'
    | 'fixedRateSeconds'
    | 'name'
    | 'timeoutSeconds'
  >;

  export interface CronPreviewResp {
    valid: boolean;
    message: string;
    zoneId: string;
    nextExecutionTimes: string[];
  }
}

export function getJobList(params?: any) {
  return requestClient.get('/system/job/list', { params });
}

export function getJobLogList(jobId: string, params?: any) {
  return requestClient.get(`/system/job/log/${jobId}`, { params });
}

export function getAllJobLogList(params?: any) {
  return requestClient.get('/system/job/log', { params });
}

export function createJob(data: SystemJobApi.JobSaveData) {
  return requestClient.post('/system/job', data);
}

export function updateJob(id: string, data: SystemJobApi.JobSaveData) {
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
