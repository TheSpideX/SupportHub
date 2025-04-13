import React, { useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  FaCube, 
  FaExpand, 
  FaCompress, 
  FaDownload, 
  FaSync, 
  FaEllipsisH,
  FaChartBar,
  FaChartPie,
  FaChartLine
} from 'react-icons/fa';
import { Button } from '@/components/ui/buttons/Button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ThreeDVisualizationProps {
  title?: string;
  description?: string;
  className?: string;
  data?: any[];
  onRefresh?: () => void;
}

const ThreeDVisualization: React.FC<ThreeDVisualizationProps> = ({
  title = '3D Data Visualization',
  description = 'Interactive 3D view of your data',
  className = '',
  data = [],
  onRefresh
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('tickets');
  const [rotation, setRotation] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [startPosition, setStartPosition] = useState({ x: 0, y: 0 });

  // Simulated data for different visualizations
  const visualizationData = {
    tickets: {
      title: 'Ticket Distribution',
      description: 'Distribution of tickets by category and priority',
      color: '#3b82f6'
    },
    users: {
      title: 'User Activity',
      description: '3D representation of user engagement over time',
      color: '#10b981'
    },
    performance: {
      title: 'System Performance',
      description: 'CPU, memory, and network usage in 3D space',
      color: '#f59e0b'
    }
  };

  // Handle refresh
  const handleRefresh = () => {
    setIsLoading(true);
    if (onRefresh) {
      onRefresh();
    }
    setTimeout(() => setIsLoading(false), 1000);
  };

  // Toggle fullscreen
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  // Mouse event handlers for 3D rotation
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setStartPosition({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    
    const deltaX = e.clientX - startPosition.x;
    const deltaY = e.clientY - startPosition.y;
    
    setRotation({
      x: rotation.x + deltaY * 0.5,
      y: rotation.y + deltaX * 0.5
    });
    
    setStartPosition({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Initialize and animate the 3D visualization
  useEffect(() => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Set canvas dimensions
    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
      }
    };
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Simulated loading
    setTimeout(() => {
      setIsLoading(false);
    }, 1500);
    
    // Animation variables
    let animationFrameId: number;
    let angle = 0;
    
    // Draw function
    const draw = () => {
      if (!ctx) return;
      
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Center of canvas
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      
      // Size of visualization
      const size = Math.min(canvas.width, canvas.height) * 0.4;
      
      // Current visualization data
      const currentViz = visualizationData[activeTab as keyof typeof visualizationData];
      
      // Draw 3D cube with perspective
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate((rotation.y + angle) * Math.PI / 180);
      
      // Front face
      ctx.beginPath();
      ctx.moveTo(-size, -size);
      ctx.lineTo(size, -size);
      ctx.lineTo(size, size);
      ctx.lineTo(-size, size);
      ctx.closePath();
      ctx.fillStyle = `${currentViz.color}33`;
      ctx.strokeStyle = currentViz.color;
      ctx.lineWidth = 2;
      ctx.fill();
      ctx.stroke();
      
      // Draw data points
      const numPoints = 50;
      for (let i = 0; i < numPoints; i++) {
        const x = (Math.random() * 2 - 1) * size;
        const y = (Math.random() * 2 - 1) * size;
        const radius = Math.random() * 5 + 2;
        
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = `${currentViz.color}aa`;
        ctx.fill();
      }
      
      // Draw connecting lines
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const x1 = (Math.random() * 2 - 1) * size;
        const y1 = (Math.random() * 2 - 1) * size;
        const x2 = (Math.random() * 2 - 1) * size;
        const y2 = (Math.random() * 2 - 1) * size;
        
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
      }
      ctx.strokeStyle = `${currentViz.color}66`;
      ctx.lineWidth = 1;
      ctx.stroke();
      
      ctx.restore();
      
      // Update angle for animation
      angle += 0.2;
      
      // Request next frame
      animationFrameId = requestAnimationFrame(draw);
    };
    
    // Start animation
    draw();
    
    // Cleanup
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationFrameId);
    };
  }, [activeTab, rotation]);

  // Animation variants
  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 260,
        damping: 20
      }
    }
  };

  return (
    <motion.div 
      className={`bg-gradient-to-br from-gray-800/90 via-gray-800/80 to-gray-800/70 backdrop-blur-md rounded-xl shadow-xl overflow-hidden border border-gray-700/50 hover:border-blue-500/30 transition-all duration-300 ${
        isFullscreen ? 'fixed inset-4 z-50' : className
      }`}
      variants={itemVariants}
      whileHover={{ y: -3, transition: { duration: 0.2 } }}
    >
      <div className="px-6 py-4 border-b border-gray-700/70 flex justify-between items-center">
        <div className="flex items-center">
          <FaCube className="h-5 w-5 text-blue-400 mr-2" />
          <div>
            <h3 className="text-lg font-semibold text-white">{title}</h3>
            <p className="text-sm text-gray-400">{description}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="bg-gray-700/50 border-gray-600/50 text-gray-300 hover:bg-gray-600/50 hover:text-white"
            onClick={handleRefresh}
          >
            <FaSync className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="bg-gray-700/50 border-gray-600/50 text-gray-300 hover:bg-gray-600/50 hover:text-white"
            onClick={toggleFullscreen}
          >
            {isFullscreen ? (
              <FaCompress className="h-3.5 w-3.5" />
            ) : (
              <FaExpand className="h-3.5 w-3.5" />
            )}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="bg-gray-700/50 border-gray-600/50 text-gray-300 hover:bg-gray-600/50 hover:text-white">
                <FaEllipsisH className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-gray-800 border border-gray-700 text-white">
              <DropdownMenuItem className="hover:bg-gray-700 focus:bg-gray-700 cursor-pointer">
                <FaDownload className="h-4 w-4 mr-2" />
                <span>Export as Image</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      
      <div className="p-4">
        <Tabs defaultValue={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-4 bg-gray-700/50 p-1">
            <TabsTrigger 
              value="tickets" 
              className={`data-[state=active]:bg-blue-600 data-[state=active]:text-white text-gray-300`}
            >
              <FaChartBar className="h-4 w-4 mr-2" />
              Tickets
            </TabsTrigger>
            <TabsTrigger 
              value="users" 
              className={`data-[state=active]:bg-blue-600 data-[state=active]:text-white text-gray-300`}
            >
              <FaChartLine className="h-4 w-4 mr-2" />
              Users
            </TabsTrigger>
            <TabsTrigger 
              value="performance" 
              className={`data-[state=active]:bg-blue-600 data-[state=active]:text-white text-gray-300`}
            >
              <FaChartPie className="h-4 w-4 mr-2" />
              Performance
            </TabsTrigger>
          </TabsList>
          
          <div 
            className="relative h-[300px] md:h-[400px]"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
          >
            {isLoading ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-16 h-16 border-4 border-gray-600 border-t-blue-500 rounded-full animate-spin"></div>
              </div>
            ) : (
              <>
                <canvas 
                  ref={canvasRef} 
                  className="w-full h-full"
                />
                <div className="absolute bottom-4 left-4 text-xs text-gray-400">
                  Click and drag to rotate
                </div>
              </>
            )}
          </div>
        </Tabs>
      </div>
    </motion.div>
  );
};

export default ThreeDVisualization;
