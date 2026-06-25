# VMware Skill Lab

VMware Skill Lab은 VMware/VCF 학습 항목을 이론 퀴즈와 커맨드 입력형 실습으로 점검하는 개인 학습 프로젝트입니다.

첫 번째 실험 범위는 `VKS L100 Foundation`입니다. Kubernetes 기본 오브젝트, vSphere with Tanzu 구조, Supervisor/TKC 구분, CNI/CSI, kubectl 기본 명령어를 문제 형식으로 풀어보며 부족한 영역을 확인할 수 있습니다.

## Features

- VKS L100 스킬셋 기반 학습 모듈
- 객관식 개념 퀴즈
- kubectl 명령어 입력형 실습
- 파트별 점수와 전체 진행률 계산
- 부족한 영역을 결과 리포트로 표시
- 브라우저 LocalStorage 기반 진행률 저장

## Learning Scope

| Module | Topic |
| --- | --- |
| 1 | Kubernetes 핵심 개념 |
| 2 | 컨테이너 vs VM 차이 |
| 3 | vSphere with Tanzu 아키텍처 |
| 4 | Supervisor / vSphere Pod / TKC 차이 |
| 5 | CNI / CSI 개념 |
| 6 | VKS 라이선스 및 에디션 |
| 7 | kubectl 기본 명령어 |

## Project Structure

| Path | Description |
| --- | --- |
| `index.html` | Application entry |
| `styles.css` | UI styles |
| `app.js` | Rendering, grading, progress state |
| `data/vks-l100.js` | VKS L100 quiz and lab data |

## Roadmap

- Expand VKS L200/L300 modules
- Add vSphere, NSX, vSAN, AVI, and VCF Operations tracks
- Add review mode for incorrect answers
- Convert the prototype to React/Vite when the learning model is stable
