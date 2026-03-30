const fs = require('fs');
let content = fs.readFileSync('/Users/agusghent/Desktop/web_dev_2026/multilingual-translator-app/Frontend/translator/src/app/translator/page.jsx', 'utf-8');

// Replace WarningModals
let re1 = /<Dialog open=\{showDevModal\}[\s\S]*?<\/Dialog>\s*<Dialog open=\{translationRestrictedDialogOpen\}[\s\S]*?<\/Dialog>/;

content = content.replace(re1, `<WarningModals
        showDevModal={showDevModal}
        setShowDevModal={setShowDevModal}
        translationRestrictedDialogOpen={translationRestrictedDialogOpen}
        setTranslationRestrictedDialogOpen={setTranslationRestrictedDialogOpen}
        handleLogin={handleLogin}
      />`);

// TranslatorControls
let re2 = /<div[\s\S]*?className="delayed-fade-in w-\[40px\][\s\S]*?onClick=\{[\s\S]*?handleCrossLang[\s\S]*?<\/div>[\s\S]*?<div[\s\S]*?className=\{`delayed-fade-in w-\[50px\][\s\S]*?onClick=\{[\s\S]*?handleTranslate[\s\S]*?<\/div>/;

content = content.replace(re2, `<TranslatorControls
        handleCrossLang={handleCrossLang}
        handleTranslate={handleTranslate}
        loadingState={loadingState}
        translationRestricted={translationRestricted}
      />`);

// RecordingModal
let re3 = /<Dialog[\s\S]*?open=\{showRecordModal\}[\s\S]*?<\/DialogContent>\s*<\/Dialog>/;
content = content.replace(re3, `<RecordingModal
        showRecordModal={showRecordModal}
        setShowRecordModal={setShowRecordModal}
        handleFullCancel={handleFullCancel}
        asrStatus={asrStatus}
        setAsrStatus={setAsrStatus}
        isRecording={isRecording}
        startRecording={startRecording}
        stopRecording={stopRecording}
        cancelTranscription={cancelTranscription}
        waveCanvasRef={waveCanvasRef}
        recordingSeconds={recordingSeconds}
        transcribeChoice={transcribeChoice}
        setTranscribeChoice={setTranscribeChoice}
        srcHint={srcHint}
        dstHint={dstHint}
        srcDisplay={srcDisplay}
        dstDisplay={dstDisplay}
        reviewTranscript={reviewTranscript}
        setReviewTranscript={setReviewTranscript}
        lastRecordingUrl={lastRecordingUrl}
        reviewAudioRef={reviewAudioRef}
        resetAudioState={resetAudioState}
        safeUnloadReviewAudio={safeUnloadReviewAudio}
        lastRecordingBlobRef={lastRecordingBlobRef}
        startTranslationFromReview={startTranslationFromReview}
        isSubmittingValidation={isSubmittingValidation}
      />`);

// Add imports
let importStatement = `import { WarningModals } from '../../components/WarningModals';\nimport { TranslatorControls } from '../../components/TranslatorControls';\nimport { RecordingModal } from '../../components/RecordingModal';\n`;

content = content.replace(/import LangsModal from/, importStatement + 'import LangsModal from');

fs.writeFileSync('/Users/agusghent/Desktop/web_dev_2026/multilingual-translator-app/Frontend/translator/src/app/translator/page.jsx', content);
console.log('Replacements completed.');
