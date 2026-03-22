import { useParams } from "wouter";
import { useState, useEffect } from "react";
import { useLecture, useLectures } from "@/hooks/useLectures";
import { analyzeImageWithAI } from "@/lib/aiService";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ImageIcon, Sparkles, Loader2, ChevronLeft, Maximize2, RotateCw, Globe } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export default function ImageAnalysisPage() {
    const { id, index } = useParams();
    const { lecture, isLoading } = useLecture(id);
    const { updateLecture } = useLectures();
    const { language: globalLanguage } = useLanguage();
    const { toast } = useToast();
    
    // Local state for the analysis view
    const [analysisLanguage, setAnalysisLanguage] = useState<"en" | "ar">("en");
    const [rotation, setRotation] = useState(0);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    const imgIndex = parseInt(index || "0", 10);
    const image = lecture?.extractedImages?.[imgIndex];

    // Initialize display language based on global language or existing descriptions
    useEffect(() => {
        if (globalLanguage === "ar") {
            setAnalysisLanguage("ar");
        }
    }, [globalLanguage]);

    const isRtl = analysisLanguage === "ar";

    const t = {
        title: isRtl ? "تحليل الصورة" : "Image Analysis",
        analyzing: isRtl ? "جاري التحليل..." : "Analyzing...",
        analyze: isRtl ? "ابدأ التحليل" : "Start Analysis",
        back: isRtl ? "العودة" : "Back",
        notFound: isRtl ? "الصورة غير موجودة" : "Image not found",
        description: isRtl ? "الوصف التحليلي" : "Analytical Description",
        noDescription: isRtl ? "لم يتم تحليل هذه الصورة بهذه اللغة بعد." : "This image has not been analyzed in this language yet.",
        rotate: isRtl ? "تدوير" : "Rotate",
        langEn: "English",
        langAr: "العربية",
        north: isRtl ? "إلى الشمال (افتراضي)" : "To North (Reset)",
    };

    const handleAnalyze = async (langOverride?: "en" | "ar") => {
        if (!lecture || !image || isAnalyzing) return;

        const targetLang = langOverride || analysisLanguage;
        setIsAnalyzing(true);
        try {
            const result = await analyzeImageWithAI(image.url, lecture.transcript || "", targetLang);
            
            const updatedImages = [...(lecture.extractedImages || [])];
            const currentImg = { ...updatedImages[imgIndex] };
            
            if (targetLang === "ar") {
                currentImg.descriptionAr = result;
            } else {
                currentImg.description = result;
            }
            
            updatedImages[imgIndex] = currentImg;

            await updateLecture({
                lectureId: lecture.id,
                updates: { extractedImages: updatedImages }
            });

            toast({
                title: isRtl ? "نجح التحليل" : "Analysis Complete",
                description: isRtl ? "تمت إضافة شرح الصورة." : "Image description added.",
            });
        } catch (error: any) {
            toast({
                title: isRtl ? "فشل التحليل" : "Analysis Failed",
                description: error.message || "Could not analyze the image",
                variant: "destructive"
            });
        } finally {
            setIsAnalyzing(false);
        }
    };

    const toggleLanguage = (lang: "en" | "ar") => {
        setAnalysisLanguage(lang);
        if (lang === "ar") {
            setRotation(0); // Change to north (0 deg) when using Arabic
            // If Arabic description doesn't exist, trigger it
            // @ts-ignore
            if (!image?.descriptionAr && !isAnalyzing) {
                handleAnalyze("ar");
            }
        }
    };

    const rotateImage = () => {
        setRotation((prev) => (prev + 90) % 360);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-background">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!lecture || !image) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4 text-center">
                <ImageIcon className="w-16 h-16 text-muted-foreground mb-4" />
                <h1 className="text-2xl font-bold mb-4">{t.notFound}</h1>
                <Button onClick={() => window.close()}>{t.back}</Button>
            </div>
        );
    }

    const currentDescription = analysisLanguage === "ar" ? image.descriptionAr : image.description;

    return (
        <div className={cn("min-h-screen bg-background p-4 md:p-8 transition-all duration-300", isRtl ? "font-arabic" : "")} dir={isRtl ? "rtl" : "ltr"}>
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-card p-6 rounded-2xl border shadow-sm">
                    <div className="flex items-center gap-4">
                        <Button variant="outline" size="icon" onClick={() => window.close()} className="shrink-0">
                            <ChevronLeft className={cn("w-5 h-5", isRtl ? "rotate-180" : "")} />
                        </Button>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
                                <Sparkles className="w-6 h-6 md:w-8 md:h-8 text-primary" />
                                {t.title}
                            </h1>
                            <p className="text-muted-foreground text-sm mt-1">
                                {lecture.title}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 self-end md:self-center">
                        {/* Language Selector */}
                        <div className="inline-flex p-1 bg-muted rounded-lg border">
                            <Button 
                                variant={analysisLanguage === "en" ? "default" : "ghost"} 
                                size="sm" 
                                onClick={() => toggleLanguage("en")}
                                className="h-8 px-4"
                            >
                                {t.langEn}
                            </Button>
                            <Button 
                                variant={analysisLanguage === "ar" ? "default" : "ghost"} 
                                size="sm" 
                                onClick={() => toggleLanguage("ar")}
                                className="h-8 px-4"
                            >
                                {t.langAr}
                            </Button>
                        </div>
                        
                        {/* Orientation Reset */}
                        <Button variant="outline" size="sm" onClick={() => setRotation(0)} className="h-10 gap-2">
                            <RotateCw className="w-4 h-4" />
                            <span className="hidden sm:inline">{t.north}</span>
                        </Button>
                    </div>
                </div>

                {/* Main Content: Beside (lg) and Below (md/sm) Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                    {/* Image Section - Top/Left */}
                    <Card className="overflow-hidden border-2 border-primary/10 shadow-xl lg:sticky lg:top-8">
                        <CardContent className="p-0 bg-muted/20 relative min-h-[300px] flex items-center justify-center overflow-hidden">
                            <motion.div 
                                animate={{ rotate: rotation }}
                                transition={{ type: "spring", stiffness: 200, damping: 20 }}
                                className="w-full h-full p-4"
                            >
                                <img
                                    src={image.url}
                                    alt="Analysis target"
                                    className="w-full h-auto max-h-[75vh] object-contain mx-auto drop-shadow-2xl"
                                />
                            </motion.div>
                            
                            {/* Rotation overlay button */}
                            <Button
                                variant="secondary"
                                size="icon"
                                className="absolute bottom-4 right-4 rounded-full shadow-lg h-12 w-12 border bg-background/80 backdrop-blur"
                                onClick={rotateImage}
                                title={t.rotate}
                            >
                                <RotateCw className="w-6 h-6" />
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Analysis Section - Right/Bottom */}
                    <Card className="border-2 border-primary/5 shadow-lg min-h-[500px] flex flex-col">
                        <CardContent className="p-0 flex-1 flex flex-col">
                            <div className="p-6 border-b bg-muted/10">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-xl font-semibold flex items-center gap-2">
                                        <Globe className="w-5 h-5 text-primary" />
                                        {t.description}
                                    </h2>
                                    {!currentDescription && !isAnalyzing && (
                                        <Button onClick={() => handleAnalyze()} className="gap-2">
                                            <Sparkles className="w-4 h-4" />
                                            {t.analyze}
                                        </Button>
                                    )}
                                </div>
                            </div>

                            <div className="p-6 flex-1 bg-card">
                                <AnimatePresence mode="wait">
                                    {isAnalyzing ? (
                                        <motion.div 
                                            key="analyzing"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-6"
                                        >
                                            <div className="relative">
                                                <Loader2 className="w-12 h-12 animate-spin text-primary" />
                                                <Sparkles className="w-5 h-5 text-primary absolute -top-1 -right-1 animate-pulse" />
                                            </div>
                                            <div className="space-y-2 text-center">
                                                <p className="text-xl font-medium animate-pulse">{t.analyzing}</p>
                                                <p className="text-sm opacity-70">Gemini 2.5 is deep-diving into the visual content...</p>
                                            </div>
                                        </motion.div>
                                    ) : currentDescription ? (
                                        <motion.div
                                            key={analysisLanguage}
                                            initial={{ opacity: 0, scale: 0.98 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            className="prose prose-lg dark:prose-invert max-w-none"
                                        >
                                            <p className={cn(
                                                "leading-relaxed whitespace-pre-wrap text-foreground/90 font-medium",
                                                isRtl ? "text-right text-2xl" : "text-left text-lg"
                                            )}>
                                                {currentDescription}
                                            </p>
                                        </motion.div>
                                    ) : (
                                        <motion.div 
                                            key="empty"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            className="flex flex-col items-center justify-center py-20 text-muted-foreground text-center space-y-4"
                                        >
                                            <div className="p-4 rounded-full bg-muted/50">
                                                <Sparkles className="w-10 h-10 opacity-30" />
                                            </div>
                                            <p className="italic text-lg">{t.noDescription}</p>
                                            <Button variant="outline" onClick={() => handleAnalyze()} className="mt-2">
                                                {t.analyze}
                                            </Button>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
