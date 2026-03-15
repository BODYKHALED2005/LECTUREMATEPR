import React, { useEffect, useState, useMemo } from "react";
import {
    ReactFlow,
    MiniMap,
    Controls,
    Background,
    useNodesState,
    useEdgesState,
    MarkerType,
    Node,
    Edge,
    ReactFlowProvider,
    useReactFlow
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import html2canvas from 'html2canvas';
import dagre from 'dagre';
import { Button } from "@/components/ui/button";
import { BrainCircuit, ChevronRight, ChevronLeft, Map, Compass, Maximize, Minimize, X } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

interface ConceptMapViewProps {
    mindmapCode: string | any;
}

interface GuideNode {
    node: string;
    explanation: string;
}

const FitViewTrigger = ({ step, isInteractive, viewMode, nodes }: { step: number; isInteractive: boolean; viewMode: string; nodes: any[] }) => {
    const { fitView } = useReactFlow();
    useEffect(() => {
        const timeout = setTimeout(() => {
            // Aggressive padding and zoom constraints for "Photo" mode
            fitView({
                padding: viewMode === 'compact' ? 0.1 : 0.2,
                duration: 800,
                minZoom: 0.05,
                maxZoom: 1
            });
        }, 200);
        return () => clearTimeout(timeout);
    }, [step, isInteractive, viewMode, nodes.length, fitView]);
    return null;
};

const NODE_WIDTH = 280;
const NODE_HEIGHT = 70;

const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'LR', isRTL = false, viewMode: 'full' | 'compact' = 'full') => {
    // Handle Vite ESM/CJS interaction for dagre
    const dagreInstance = dagre.graphlib ? dagre : (dagre as any).default;
    if (!dagreInstance || !dagreInstance.graphlib) {
        throw new Error("Dagre instance could not be loaded correctly.");
    }

    const dagreGraph = new dagreInstance.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));

    // Summary mode specific layout values
    const nodeW = viewMode === 'compact' ? 400 : NODE_WIDTH;
    const nodeH = viewMode === 'compact' ? 100 : NODE_HEIGHT;
    const rSep = viewMode === 'compact' ? 100 : 150; // Tighter vertical gaps
    const nSep = viewMode === 'compact' ? 60 : 100;  // Tighter horizontal gaps

    dagreGraph.setGraph({ rankdir: direction, ranksep: rSep, nodesep: nSep, ranker: 'longest-path' });

    nodes.forEach((node) => {
        dagreGraph.setNode(String(node.id), { width: nodeW, height: nodeH });
    });

    const validNodeIds = new Set(nodes.map(n => String(n.id)));
    const validEdges = edges.filter(
        (edge) => validNodeIds.has(String(edge.source)) && validNodeIds.has(String(edge.target))
    );

    validEdges.forEach((edge) => {
        dagreGraph.setEdge(String(edge.source), String(edge.target));
    });

    dagreInstance.layout(dagreGraph);

    nodes.forEach((node) => {
        const nodeWithPosition = dagreGraph.node(String(node.id));
        node.targetPosition = 'top' as any;
        node.sourcePosition = 'bottom' as any;

        if (nodeWithPosition) {
            node.position = {
                x: nodeWithPosition.x - (nodeW / 2),
                y: nodeWithPosition.y - (nodeH / 2),
            };
        }
    });

    return { nodes, edges: validEdges };
};

export function ConceptMapView({ mindmapCode }: ConceptMapViewProps) {
    const { language, isRTL } = useLanguage();

    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

    const [guide, setGuide] = useState<GuideNode[]>([]);
    const [isInteractive, setIsInteractive] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);
    const [isTransitioning, setIsTransitioning] = useState(false);
    const [parseError, setParseError] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [viewMode, setViewMode] = useState<'full' | 'compact'>('full');
    const [levelMap, setLevelMap] = useState<Record<string, number>>({});

    // Track original layouted nodes to avoid losing styles when mutating for visibility
    const [originalNodes, setOriginalNodes] = useState<Node[]>([]);
    const [originalEdges, setOriginalEdges] = useState<Edge[]>([]);

    useEffect(() => {
        if (!mindmapCode) return;

        try {
            const parsed = typeof mindmapCode === "string" ? JSON.parse(mindmapCode) : mindmapCode;
            const nodesData = parsed.nodes || [];
            const edgesData = parsed.edges || [];

            // 1. Calculate Levels using BFS
            const levelMapData: Record<string, number> = {};
            if (nodesData.length > 0) {
                const adj: Record<string, string[]> = {};
                edgesData.forEach((e: any) => {
                    if (!adj[e.source]) adj[e.source] = [];
                    adj[e.source].push(e.target);
                });

                const rootId = String(nodesData[0].id);
                levelMapData[rootId] = 0;
                const queue: [string, number][] = [[rootId, 0]];
                const visited = new Set([rootId]);

                while (queue.length > 0) {
                    const [currId, level] = queue.shift()!;
                    levelMapData[currId] = level;

                    (adj[currId] || []).forEach(nextId => {
                        if (!visited.has(nextId)) {
                            visited.add(nextId);
                            queue.push([nextId, level + 1]);
                        }
                    });
                }
                setLevelMap(levelMapData);
            }

            // 2. Define Level Styles
            const getLevelStyle = (level: number) => {
                const styles = [
                    { // Level 0 (Root) - Pink/Rose
                        background: 'linear-gradient(135deg, #fce7f3 0%, #fbcfe8 100%)',
                        border: '2px solid #f472b6',
                        color: '#831843',
                    },
                    { // Level 1 - Indigo/Blue
                        background: 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)',
                        border: '2px solid #818cf8',
                        color: '#1e1b4b',
                    },
                    { // Level 2 - Emerald/Green
                        background: 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)',
                        border: '2px solid #4ade80',
                        color: '#064e3b',
                    },
                    { // Level 3 - Amber/Orange
                        background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                        border: '2px solid #fbbf24',
                        color: '#78350f',
                    },
                    { // Level 4+ - Slate/Neutral
                        background: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)',
                        border: '2px solid #94a3b8',
                        color: '#1e293b',
                    }
                ];
                return styles[Math.min(level, styles.length - 1)];
            };

            let initialNodes: Node[] = nodesData.map((n: any) => {
                const level = levelMapData[String(n.id)] || 0;
                const levelStyle = getLevelStyle(level);

                return {
                    id: String(n.id),
                    data: { label: n.label || "Unnamed Concept" },
                    position: { x: 0, y: 0 },
                    style: {
                        ...levelStyle,
                        borderRadius: '12px',
                        padding: '12px 16px',
                        fontWeight: 'bold',
                        fontSize: level === 0 ? '15px' : '14px',
                        textAlign: isRTL ? 'right' : 'left',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                        width: NODE_WIDTH,
                        minHeight: NODE_HEIGHT,
                        wordWrap: 'break-word',
                    },
                };
            });

            let initialEdges: Edge[] = edgesData.map((e: any) => ({
                id: String(e.id || `${e.source}-${e.target}`),
                source: String(e.source),
                target: String(e.target),
                type: 'smoothstep',
                label: e.label || undefined,
                animated: false,
                style: { stroke: '#6366f1', strokeWidth: 3, opacity: 0.8 }, // Indigo arrow
                labelStyle: {
                    fill: '#be185d', // Distinct Pink/Deeppink for text
                    fontSize: 12,
                    fontWeight: '800',
                    paintOrder: 'stroke',
                    stroke: '#ffffff',
                    strokeWidth: '3px',
                },
                markerEnd: {
                    type: MarkerType.ArrowClosed,
                    color: '#6366f1',
                    width: 20,
                    height: 20,
                },
            }));

            const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
                initialNodes,
                initialEdges,
                'TB',
                isRTL
            );

            setOriginalNodes(layoutedNodes);
            setOriginalEdges(layoutedEdges);
            setNodes(layoutedNodes);
            setEdges(layoutedEdges);

            if (parsed.interactiveGuide && Array.isArray(parsed.interactiveGuide)) {
                setGuide(parsed.interactiveGuide);
            }

            setParseError(false);
        } catch (e) {
            console.error("Failed to parse map data:", e);
            setParseError(true);
        }
    }, [mindmapCode, isRTL]);

    // Enhanced string normalization for robust matching
    const normalizeText = (text: string) => {
        if (!text) return "";
        // Remove all non-alphanumeric chars (including Arabic diacritics), keep spaces, trim, lowercase
        return String(text)
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove accents/diacritics
            .replace(/[^\w\u0621-\u064A\s]/g, '') // Keep Arabic letters, English letters, numbers, spaces. Remove symbols
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
    };

    const nextStep = () => {
        if (isTransitioning) return;
        setIsTransitioning(true);
        setCurrentStep(prev => Math.min(prev + 1, guide.length - 1));
        setTimeout(() => setIsTransitioning(false), 400); // Wait for transition to finish
    };

    const prevStep = () => {
        if (isTransitioning) return;
        setIsTransitioning(true);
        setCurrentStep(prev => Math.max(prev - 1, -1));
        setTimeout(() => setIsTransitioning(false), 400);
    };

    useEffect(() => {
        if (!originalNodes || originalNodes.length === 0) return;

        if (!isInteractive || guide.length === 0) {
            if (viewMode === 'compact') {
                const compactNodeIds = new Set(
                    originalNodes.filter(n => (levelMap[n.id] ?? 0) <= 3).map(n => n.id)
                );

                // 1. Filter and SCALE nodes
                const filteredNodes = originalNodes
                    .filter(n => compactNodeIds.has(n.id))
                    .map(n => {
                        const level = levelMap[n.id] || 0;
                        return {
                            ...n,
                            style: {
                                ...n.style,
                                fontSize: level === 0 ? '24px' : '18px', // Significantly larger text
                                padding: '20px 24px',
                                width: 400,
                                minHeight: 100,
                                borderRadius: '16px',
                            }
                        };
                    });

                // 2. Filter and SCALE edges
                const filteredEdges = originalEdges
                    .filter(e => compactNodeIds.has(e.source) && compactNodeIds.has(e.target))
                    .map(e => ({
                        ...e,
                        style: { ...e.style, strokeWidth: 5 }, // Thicker arrows
                        labelStyle: { ...e.labelStyle, fontSize: 16 }, // Larger labels
                        markerEnd: (typeof e.markerEnd === 'object' && e.markerEnd !== null) ? {
                            ...e.markerEnd,
                            width: 20,
                            height: 20,
                        } : e.markerEnd,
                    }));

                // 3. RE-LAYOUT specifically for this subset and scale
                const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
                    filteredNodes,
                    filteredEdges,
                    'TB',
                    isRTL,
                    'compact'
                );

                setNodes(layoutedNodes);
                setEdges(layoutedEdges);
            } else {
                setNodes(originalNodes);
                setEdges(originalEdges);
            }
            return;
        }

        // 1. Identify which nodes should be visible based on the guide
        const visibleNodeIds = new Set<string>();
        visibleNodeIds.add(originalNodes[0].id); // Always root
        let currentActiveNodeId: string | null = null;

        if (currentStep >= 0) {
            for (let i = 0; i <= currentStep; i++) {
                const gText = normalizeText(guide[i].node);
                let bestMatchId: string | null = null;
                let bestScore = -1;

                originalNodes.forEach(n => {
                    const nText = normalizeText(n.data.label as string);
                    if (!nText || !gText) return;

                    let score = -1;
                    if (nText === gText) {
                        score = 1000;
                    } else if (nText.includes(gText)) {
                        score = 100 - (nText.length - gText.length);
                    } else if (gText.includes(nText)) {
                        score = 100 - (gText.length - nText.length);
                    }

                    if (score > bestScore) {
                        bestScore = score;
                        bestMatchId = n.id;
                    }
                });

                if (bestMatchId) {
                    visibleNodeIds.add(bestMatchId);
                    if (i === currentStep) {
                        currentActiveNodeId = bestMatchId;
                    }
                }
            }
        } else {
            currentActiveNodeId = originalNodes[0].id;
        }

        // 2. Ensure connectivity: Include any parent nodes necessary to connect visible nodes back to the root
        let addedNew = true;
        while (addedNew) {
            addedNew = false;
            originalEdges.forEach(e => {
                if (visibleNodeIds.has(e.target) && !visibleNodeIds.has(e.source)) {
                    visibleNodeIds.add(e.source);
                    addedNew = true;
                }
            });
        }

        const visibleOriginalNodes = originalNodes.filter(n => visibleNodeIds.has(n.id));
        const visibleOriginalEdges = originalEdges.filter(e =>
            visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target)
        );

        // 3. RELAYOUT: recalculate the graph geometry for ONLY the currently visible elements
        // Deep clone to avoid mutating the originalNodes state
        const nodesToLayout = visibleOriginalNodes.map(n => ({ ...n, position: { ...n.position }, data: { ...n.data }, style: { ...n.style } }));
        const edgesToLayout = visibleOriginalEdges.map(e => ({ ...e, style: { ...e.style }, data: e.data ? { ...e.data } : {} }));

        const { nodes: relayoutedNodes, edges: relayoutedEdges } = getLayoutedElements(
            nodesToLayout,
            edgesToLayout,
            'TB',
            isRTL
        );

        // 4. Apply current styling (glow) to the active concept
        const decoratedNodes = relayoutedNodes.map(n => {
            const isCurrent = n.id === currentActiveNodeId;
            return {
                ...n,
                hidden: false,
                // Add scale-105 class instead of style transform to avoid overriding React Flow's positioning
                className: isCurrent ? 'scale-[1.03] transition-transform duration-300' : 'scale-100 transition-transform duration-300',
                style: {
                    ...n.style,
                    opacity: isCurrent ? 1 : 0.7,
                    pointerEvents: 'auto' as any,
                    boxShadow: isCurrent ? '0 0 0 4px rgba(99, 102, 241, 0.4)' : n.style?.boxShadow,
                    // DO NOT use 'transform' or 'all' in transition here; it conflicts with React Flow's inline transform!
                    transition: 'opacity 0.4s ease-out, box-shadow 0.4s ease-out',
                    zIndex: isCurrent ? 1000 : 1,
                }
            };
        });

        const activeEdges = relayoutedEdges.map(e => {
            return {
                ...e,
                hidden: false,
                style: {
                    ...e.style,
                    opacity: 1,
                    transition: 'opacity 0.4s ease-out'
                },
                labelStyle: {
                    ...e.labelStyle,
                    opacity: 1,
                    transition: 'opacity 0.4s ease-out'
                }
            };
        });

        setNodes(decoratedNodes);
        setEdges(activeEdges);

    }, [isInteractive, currentStep, guide, originalNodes, originalEdges, isRTL, setNodes, setEdges, viewMode, levelMap]);

    const startPresentation = () => {
        setIsInteractive(true);
        setIsFullscreen(true);
        setCurrentStep(-1);
    };

    const exitPresentation = () => {
        setIsInteractive(false);
        setIsFullscreen(false);
        setCurrentStep(0);
    };

    const downloadMap = async () => {
        const element = document.querySelector('.react-flow__renderer') as HTMLElement;
        if (!element) return;

        try {
            const canvas = await html2canvas(element, {
                backgroundColor: viewMode === 'compact' ? '#ffffff' : '#f8fafc',
                logging: false,
                useCORS: true,
                scale: 2, // Higher quality
            });

            const dataUrl = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.download = `concept-map-${Date.now()}.png`;
            link.href = dataUrl;
            link.click();
        } catch (err) {
            console.error("Failed to download map:", err);
        }
    };

    if (parseError) {
        return (
            <div className="w-full min-h-[400px] flex items-center justify-center border-2 border-dashed border-destructive/50 rounded-xl bg-destructive/5 p-8 text-center flex-col">
                <BrainCircuit className="w-12 h-12 text-destructive/50 mb-4 animate-pulse" />
                <h4 className="text-lg font-bold text-destructive mb-2">
                    {language === 'ar' ? 'حدث خطأ أثناء تحميل الخريطة' : 'Error rendering Concept Map'}
                </h4>
                <p className="text-muted-foreground text-sm max-w-lg mb-4">
                    {language === 'ar' ? 'نمط البيانات غير متوافق. يرجى مسح السجل وإعادة المحاولة.' : 'Data syntax incompatible. Please clear log and retry.'}
                </p>

                {/* DEBUG VIEW FOR THE USER */}
                <div className="w-full text-left mt-4">
                    <p className="font-bold text-sm mb-2 text-destructive">Debug - Received Data:</p>
                    <pre className="bg-background text-foreground p-4 rounded-md overflow-x-auto text-xs whitespace-pre-wrap max-h-[300px] border border-destructive/20">
                        {typeof mindmapCode === 'string' ? mindmapCode : JSON.stringify(mindmapCode, null, 2)}
                    </pre>
                </div>
            </div>
        );
    }

    if (!mindmapCode || nodes.length === 0) {
        return (
            <div className="w-full min-h-[400px] flex items-center justify-center border-2 border-dashed border-muted rounded-xl bg-card/50 p-8 text-center flex-col">
                <Map className="w-12 h-12 text-muted-foreground mb-4" />
                <h4 className="text-lg font-bold text-foreground mb-2">
                    {language === 'ar' ? 'لا توجد خريطة مفاهيمية' : 'No Concept Map Available'}
                </h4>
                <p className="text-muted-foreground text-sm max-w-lg mb-4">
                    {language === 'ar' ? 'نموذج الذكاء الاصطناعي لم يقم بإنشاء خريطة لهذه المحاضرة حتى الآن. يمكنك إغلاق المحاضرة وإعادة معالجتها.' : 'The AI model has not generated a map for this lecture yet. Please re-run the AI process to create one.'}
                </p>
            </div>
        );
    }

    return (
        <div className="w-full space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className={cn("flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4", isRTL ? "sm:flex-row-reverse" : "")}>
                <div className={cn("flex items-center gap-2", isRTL ? "flex-row-reverse" : "")}>
                    <BrainCircuit className="w-5 h-5 text-primary" />
                    <h3 className="text-lg font-semibold">
                        {language === 'ar' ? 'الخريطة المفاهيمية' : 'Concept Map'}
                    </h3>
                </div>

                <div className="flex flex-wrap gap-2 items-center">
                    <div className="flex items-center bg-muted/30 p-1 rounded-lg mr-2 border border-border/50">
                        <Button
                            variant={viewMode === 'compact' ? "secondary" : "ghost"}
                            size="sm"
                            onClick={() => { setViewMode('compact'); setIsInteractive(false); }}
                            className={cn("px-4 h-8 text-xs font-semibold", viewMode === 'compact' ? "shadow-sm bg-background" : "")}
                        >
                            <Minimize className="w-3.5 h-3.5 mr-1.5" />
                            {language === 'ar' ? 'ملخص' : 'Summary'}
                        </Button>
                        <Button
                            variant={viewMode === 'full' ? "secondary" : "ghost"}
                            size="sm"
                            onClick={() => setViewMode('full')}
                            className={cn("px-4 h-8 text-xs font-semibold", viewMode === 'full' ? "shadow-sm bg-background" : "")}
                        >
                            <Map className="w-3.5 h-3.5 mr-1.5" />
                            {language === 'ar' ? 'كامل' : 'Full'}
                        </Button>
                    </div>

                    {guide.length > 0 && !isFullscreen && (
                        <Button
                            variant="default"
                            size="sm"
                            onClick={startPresentation}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md transition-all"
                        >
                            <BrainCircuit className="w-4 h-4 mr-2" />
                            {language === 'ar' ? 'بدء وضع العرض التفاعلي' : 'Start Interactive Presentation'}
                        </Button>
                    )}
                    {!isFullscreen && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsFullscreen(true)}
                            className="bg-background border-border"
                        >
                            <Maximize className="w-4 h-4 mr-2" />
                            {language === 'ar' ? 'وضع ملء الشاشة' : 'Fullscreen Map'}
                        </Button>
                    )}

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={downloadMap}
                        className="bg-background border-border hover:bg-muted"
                    >
                        <Compass className="w-4 h-4 mr-2" />
                        {language === 'ar' ? 'تحميل كصورة' : 'Download Image'}
                    </Button>
                </div>
            </div>

            <div className={cn(
                "relative w-full overflow-hidden shadow-sm flex flex-col transition-all duration-300",
                isFullscreen ? "fixed inset-0 z-50 h-screen w-screen m-0 rounded-none bg-background border-none" : "h-[80vh] min-h-[800px] border border-border bg-card/50 rounded-xl"
            )}>

                {/* Interactive Player Mode Header (Above Map) */}
                {isInteractive && guide.length > 0 && (
                    <div className="w-full relative z-20 bg-background/95 backdrop-blur-md border-b border-border p-6 pr-20 shadow-sm flex flex-col transition-colors">
                        {/* Exit button isolated at Absolute Top Right */}
                        <Button
                            size="icon"
                            variant="destructive"
                            onClick={exitPresentation}
                            className="absolute top-6 right-6 rounded-full w-10 h-10 shadow-md hover:scale-105 transition-transform z-50"
                            style={{ right: '1.5rem' }}
                        >
                            <X className="w-5 h-5" />
                        </Button>

                        <div className="flex items-center justify-between mb-4">
                            <span className="text-sm font-semibold text-primary/80 uppercase tracking-widest flex items-center gap-2">
                                <BrainCircuit className="w-4 h-4" />
                                {currentStep === -1
                                    ? (language === 'ar' ? 'مقدمة الخريطة' : 'Map Intro')
                                    : `${language === 'ar' ? 'الشرح التفاعلي' : 'Guided Context'} (${currentStep + 1} / ${guide.length})`}
                            </span>
                            <div className="flex gap-2 items-center">
                                <Button size="sm" variant="outline" onClick={prevStep} disabled={currentStep === -1 || isTransitioning} className="hover:bg-primary/10 transition-opacity">
                                    <ChevronLeft className="w-4 h-4" />
                                </Button>
                                <Button size="sm" variant="default" onClick={nextStep} disabled={currentStep === guide.length - 1 || isTransitioning} className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-md transition-opacity">
                                    <ChevronRight className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>

                        <h4 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-600 mb-3">
                            {currentStep === -1 ? String(originalNodes[0]?.data.label || '') : guide[currentStep].node}
                        </h4>
                        <div className="text-muted-foreground leading-relaxed text-sm md:text-base space-y-2 max-w-4xl">
                            {currentStep === -1
                                ? <p>{language === 'ar' ? 'مرحباً بك في العرض التفاعلي. سنقوم هنا ببناء واستكشاف تفاصيل هذه الخريطة الذهنية تدريجياً خطوة بخطوة. اكتشف كيف تترابط المفاهيم عبر الضغط على السهم التالي للمتابعة.' : 'Welcome to the interactive presentation. We will build and explore this concept map step by step here. Discover how the concepts are connected by clicking the next arrow.'}</p>
                                : guide[currentStep].explanation.split('\n').map((para, i) => (
                                    para.trim() ? <p key={i}>{para}</p> : null
                                ))}
                        </div>

                        <div className="w-full h-1.5 bg-secondary mt-6 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-primary transition-all duration-300 ease-out"
                                style={{ width: currentStep === -1 ? '0%' : `${((currentStep + 1) / guide.length) * 100}%` }}
                            />
                        </div>
                    </div>
                )}

                <ReactFlowProvider>
                    <FitViewTrigger step={currentStep} isInteractive={isInteractive} viewMode={viewMode} nodes={nodes} />
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        fitView
                        minZoom={0.05}
                        proOptions={{ hideAttribution: true }}
                        nodesConnectable={false}
                        nodesDraggable={viewMode === 'full' && !isInteractive}
                        panOnScroll={true}
                        panOnDrag={true}
                        zoomOnScroll={true}
                        zoomOnPinch={true}
                        zoomOnDoubleClick={true}
                        preventScrolling={false}
                    >
                        {viewMode === 'full' && <Background color="#cbd5e1" gap={20} size={1} />}
                        {viewMode === 'compact' && <div className="absolute inset-0 bg-white" style={{ zIndex: -1 }} />}
                        {viewMode === 'full' && <Controls />}
                        {viewMode === 'full' && <MiniMap zoomable pannable nodeColor={(n) => {
                            if (n.style?.background) return n.style.background as string;
                            return '#eee';
                        }} />}
                    </ReactFlow>
                </ReactFlowProvider>

                {/* Exit fullscreen button (fallback if not in interactive mode) */}
                {isFullscreen && !isInteractive && (
                    <Button
                        variant="destructive"
                        size="icon"
                        onClick={exitPresentation}
                        className="absolute top-4 right-4 z-[9999] shadow-xl rounded-full h-12 w-12 hover:scale-105 transition-transform"
                    >
                        <X className="w-6 h-6" />
                    </Button>
                )}
            </div>
        </div>
    );
}
