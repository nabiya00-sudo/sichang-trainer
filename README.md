# 시창 트레이너 (v0.1)

혼자 쓰는 시창(시창·청음) 훈련 PWA. 서버 없이 정적 파일만으로 동작합니다.

## 실행
```bash
npm install
npm run dev        # 개발 서버 (http://localhost:5173)
npm run build      # dist/ 에 배포용 파일 생성
```
마이크는 `localhost` 또는 HTTPS에서만 동작합니다. 태블릿에서 쓰려면 HTTPS로 호스팅하세요.

## 구성
- `src/melody.js` 레벨별 선율 생성, 조/옥타브 선택(음역 안에 들어오도록)
- `src/notation.js` VexFlow 악보 (남성 성부 8vb 표기), 계이름 라벨
- `src/pitch.js` 마이크 음정 검출(pitchy), 옥타브 무시 비교
- `src/audio.js` 피아노 샘플 재생(Web Audio), 메트로놈
- `src/terms.js` 레벨별 악보 용어
- `src/store.js` 기록 저장(localStorage) / JSON 백업
- `public/audio/piano/` Salamander 샘플 10개 (C3~D#5, 3반음 간격)

## 채점 규칙
- 각 음 구간의 중앙값을 목표음과 비교, 옥타브는 무시, ±25¢ 초록 · ±50¢ 노랑 · 그 밖 빨강
- 적중률 80% 이상 2회 연속 → 레벨 업, 50% 미만 → 레벨 다운

## 출처 표기
Piano: Salamander Grand Piano (Alexander Holm, CC BY 3.0) — https://github.com/sfzinstruments/SalamanderGrandPiano
