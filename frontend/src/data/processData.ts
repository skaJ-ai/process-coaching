import { HRModule } from '../types';

export const hrModules: HRModule[] = [
  {
    l4: '채용(Recruiting)',
    tasks: [
      {
        l5: '서류 전형(Screening)',
        l6_activities: [
          '서류 심사(Review)',
          '적격 심사(Eligibility Check)',
          '서류 결과 통보(Result Notification)',
        ],
      },
      {
        l5: '면접(Interview)',
        l6_activities: [
          '면접 일정 조율(Schedule Coordination)',
          '면접 실시(Conduct Interview)',
          '면접 평가(Interview Evaluation)',
          '면접 결과 통보(Result Notification)',
        ],
      },
      {
        l5: '입사(Onboarding)',
        l6_activities: [
          '입사 서류 준비(Document Preparation)',
          '시스템 계정 생성(Account Creation)',
          '오리엔테이션(Orientation)',
        ],
      },
    ],
  },
  {
    l4: '급여(Payroll)',
    tasks: [
      {
        l5: '급여 마감(Payroll Closing)',
        l6_activities: [
          '근태 데이터 집계(Attendance Aggregation)',
          '급여 계산(Salary Calculation)',
          '급여 검증(Payroll Verification)',
          '급여 이체(Salary Transfer)',
        ],
      },
      {
        l5: '급여 명세서 발송(Payroll Slip Distribution)',
        l6_activities: [
          '명세서 생성(Slip Generation)',
          '명세서 발송(Slip Distribution)',
        ],
      },
    ],
  },
  {
    l4: '교육(Training)',
    tasks: [
      {
        l5: '교육 과정 개설(Course Creation)',
        l6_activities: [
          '교육 요구 분석(Needs Analysis)',
          '과정 설계(Course Design)',
          '강사 섭외(Instructor Recruitment)',
        ],
      },
      {
        l5: '교육생 모집(Trainee Recruitment)',
        l6_activities: [
          '모집 공고(Recruitment Notice)',
          '신청 접수(Application Receipt)',
          '선발(Selection)',
        ],
      },
      {
        l5: '교육 완료 평가(Training Completion Evaluation)',
        l6_activities: [
          '평가 실시(Conduct Evaluation)',
          '결과 분석(Result Analysis)',
          '수료증 발급(Certificate Issuance)',
        ],
      },
    ],
  },
  {
    l4: '인사(HR)',
    tasks: [
      {
        l5: '휴직(Leave)',
        l6_activities: [
          '휴직 신청(Leave Application)',
          '승인 처리(Approval Processing)',
          '복직 처리(Return Processing)',
        ],
      },
      {
        l5: '퇴사(Resignation)',
        l6_activities: [
          '퇴사 신청(Resignation Application)',
          '업무 인수인계(Handover)',
          '퇴사 처리(Resignation Processing)',
          '퇴직금 정산(Severance Settlement)',
        ],
      },
    ],
  },
];
