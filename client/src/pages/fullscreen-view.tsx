import { useParams } from "wouter";
import { useLecture } from "@/hooks/useLectures";
import { TranscriptView } from "@/components/lecture/TranscriptView";
import { SummaryView } from "@/components/lecture/SummaryView";
import { QuizView } from "@/components/lecture/QuizView";
import { SlidesView } from "@/components/lecture/SlidesView";
import { FlashcardsView } from "@/components/lecture/FlashcardsView";
import { FormulasView } from "@/components/lecture/FormulasView";
import { ConceptMapView } from "@/components/lecture/ConceptMapView";
import { AgentChatView } from "@/components/lecture/AgentChatView";
import { ImagesView } from "@/components/lecture/ImagesView";
import { Loader2, AlertCircle } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { useLectures } from "@/hooks/useLectures";

export default function FullscreenView() {
  const { id, tab } = useParams();
  const { lecture, isLoading } = useLecture(id);
  const { language } = useLanguage();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!lecture) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
        <AlertCircle className="w-12 h-12 text-destructive mb-4" />
        <h1 className="text-2xl font-bold mb-2">
          {language === "ar" ? "المحاضرة غير موجودة" : "Lecture not found"}
        </h1>
        <Button onClick={() => window.close()}>
          {language === "ar" ? "إغلاق" : "Close"}
        </Button>
      </div>
    );
  }

  const renderContent = () => {
    switch (tab) {
      case "transcript":
        return <TranscriptView text={lecture.transcript || ""} title={lecture.title} />;
      case "summary":
        return <SummaryView summary={lecture.summary || []} title={lecture.title} />;
      case "quiz":
        return (
          <QuizView
            questions={lecture.questions}
            title={lecture.title}
            lectureId={lecture.id}
            transcript={lecture.transcript}
            modelType={lecture.modelType || "api"}
          />
        );
      case "slides":
        return (
          <SlidesView
            slides={lecture.slides || []}
            title={lecture.title}
            transcript={lecture.transcript}
            summary={lecture.summary}
            lectureId={lecture.id}
          />
        );
      case "flashcards":
        return <FlashcardsView flashcards={lecture.flashcards || []} />;
      case "formulas":
        return <FormulasView formulas={lecture.formulas || []} />;
      case "conceptMap":
        return <ConceptMapView mindmapCode={lecture.conceptMap} />;
      case "chat":
        return (
          <AgentChatView
            transcript={lecture.transcript || ""}
            title={lecture.title}
            mode={lecture.modelType || "api"}
          />
        );
      case "images":
        return (
           <ImagesView 
            lectureId={lecture.id}
            images={lecture.extractedImages || []}
            onAnalysisRequested={() => {}} // Analysis can be handled in main window or I could link it
           />
        );
      default:
        return (
          <div className="text-center p-8">
            <p className="text-muted-foreground">Tab content not found: {tab}</p>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8" dir={language === "ar" ? "rtl" : "ltr"}>
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8 border-b pb-4">
           <div>
              <h1 className="text-2xl font-bold">{lecture.title}</h1>
              <p className="text-sm text-muted-foreground capitalize">{tab}</p>
           </div>
           <Button variant="outline" onClick={() => window.close()}>
              {language === "ar" ? "إغلاق النافذة" : "Close Window"}
           </Button>
        </div>
        {renderContent()}
      </div>
    </div>
  );
}
