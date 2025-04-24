// pages/snake/snake.js
Page({
  data: {
    // 游戏区域大小
    boardSize: 15,
    // 蛇的身体，每个元素是一个坐标对象 {x, y}
    snake: [{x: 7, y: 7}, {x: 6, y: 7}, {x: 5, y: 7}],
    // 食物位置
    food: {x: 10, y: 10},
    // 特殊食物
    specialFood: {
      x: 0,
      y: 0,
      active: false,
      points: 5,
      duration: 10000, // 特殊食物持续时间（毫秒）
      interval: 20000, // 特殊食物出现间隔（毫秒）
      timer: null,
      color: '#FFD700',
      colorDark: '#DAA520'
    },
    // 障碍物
    obstacles: [],
    // 移动方向: 'right', 'left', 'up', 'down'
    direction: 'right',
    // 游戏状态: 'playing', 'paused', 'gameover'
    gameStatus: 'paused',
    // 分数
    score: 0,
    highScore: 0,
    isHighScore: false,
    scoreAnimation: false,
    // 游戏速度（毫秒）
    speed: 300,
    // 定时器ID
    interval: null,
    // 是否开启边界穿越模式
    boundaryMode: false,
    // 游戏模式: 'classic', 'timed', 'obstacle'
    gameMode: 'classic',
    // 倒计时
    countdown: 0,
    // 限时模式的剩余时间
    timeLimit: 60, // 60秒
    timeRemaining: 100, // 百分比
    timeTimer: null,
    // 颜色相关
    snakeColorIndex: 0,
    foodColorIndex: 0,
    // 存储每个蛇身体段的颜色
    snakeSegmentColors: ['#2A9D8F', '#4ECDC4', '#8EEDC7'],
    // 预定义的颜色数组 - 蛇身颜色
    snakeColors: [
      '#2A9D8F', // 默认青绿色
      '#E63946', // 鲜红色
      '#4361EE', // 蓝色
      '#9D4EDD', // 紫色
      '#FB8500', // 橙色
      '#2EC4B6', // 绿松石色
      '#F72585', // 粉色
      '#F72585', // 粉色 (增加粉色概率)
      '#F72585', // 粉色 (增加粉色概率)
      '#3A86FF', // 天蓝色
      '#8AC926', // 黄绿色
      '#FFBE0B'  // 金黄色
    ],
    // 预定义的颜色数组 - 食物颜色
    foodColors: [
      '#FF7F50', // 默认珊瑚色
      '#FF5733', // 红橙色
      '#6EEB83', // 荧光绿
      '#FF758F', // 粉红色
      '#FFD166', // 蛋黄色
      '#06D6A0', // 薄荷色
      '#118AB2', // 深蓝色
      '#FFC6FF', // 浅粉色
      '#FF9E00', // 琥珀色
      '#BC00DD'  // 紫罗兰色
    ]
  },

  // 检查坐标是否是蛇头
  isSnakeHead: function(x, y) {
    const head = this.data.snake[0];
    return head.x === x && head.y === y;
  },

  // 检查坐标是否是蛇身
  isSnakeBody: function(x, y) {
    return this.data.snake.slice(1).some(segment => segment.x === x && segment.y === y);
  },

  // 检查坐标是否是食物
  isFood: function(x, y) {
    const food = this.data.food;
    return food.x === x && food.y === y;
  },

  onLoad: function() {
    // 加载最高分数
    const highScore = wx.getStorageSync('snakeHighScore') || 0;
    this.setData({
      highScore: highScore
    });
    
    // 初始化游戏
    this.initGame();
  },

  onUnload: function() {
    // 清理定时器
    this.stopGame();
    this.clearSpecialFoodTimer();
    this.clearTimeTimer();
  },

  // 清除特殊食物定时器
  clearSpecialFoodTimer: function() {
    if (this.data.specialFood.timer) {
      clearTimeout(this.data.specialFood.timer);
    }
  },

  // 清除限时模式定时器
  clearTimeTimer: function() {
    if (this.data.timeTimer) {
      clearInterval(this.data.timeTimer);
    }
  },

  // 切换游戏模式
  switchGameMode: function(e) {
    if (this.data.gameStatus === 'playing') {
      this.pauseGame();
    }
    
    const mode = e.currentTarget.dataset.mode;
    
    this.setData({
      gameMode: mode
    });
    
    this.resetGame();
  },

  // 初始化游戏
  initGame: function() {
    // 根据游戏模式初始化不同的设置
    let obstaclesArray = [];
    
    if (this.data.gameMode === 'obstacle') {
      // 创建随机障碍物
      obstaclesArray = this.generateObstacles();
    }
    
    // 更新蛇和食物的颜色
    this.updateColors();
    
    // 生成食物，这会同时设置食物颜色
    const newFood = this.generateFood(obstaclesArray);
    
    this.setData({
      snake: [{x: 7, y: 7}, {x: 6, y: 7}, {x: 5, y: 7}],
      food: newFood,
      specialFood: {
        ...this.data.specialFood,
        active: false
      },
      obstacles: obstaclesArray,
      direction: 'right',
      gameStatus: 'paused',
      score: 0,
      isHighScore: false,
      speed: 300,
      countdown: 0,
      timeRemaining: 100
    });
    
    this.clearSpecialFoodTimer();
    this.clearTimeTimer();
  },

  // 更新蛇和食物的颜色 - 每局随机选择
  updateColors: function() {
    // 随机选择蛇头颜色索引
    const snakeColorIndex = Math.floor(Math.random() * this.data.snakeColors.length);
    
    // 更新颜色索引
    this.setData({
      snakeColorIndex
    });
    
    // 获取颜色值
    const snakeColor = this.data.snakeColors[snakeColorIndex];
    
    // 为蛇的每个段生成随机颜色
    this.generateSnakeSegmentColors();
    
    // 设置CSS变量
    this.setCssVariables(snakeColor);
  },
  
  // 为蛇的每个段生成随机不同的颜色
  generateSnakeSegmentColors: function() {
    const snakeLength = this.data.snake.length;
    const segmentColors = [];
    
    // 为蛇的每个段生成随机颜色
    for (let i = 0; i < snakeLength; i++) {
      let colorIndex = Math.floor(Math.random() * this.data.snakeColors.length);
      const color = this.data.snakeColors[colorIndex];
      segmentColors.push(color);
    }
    
    // 更新到data中
    this.setData({
      snakeSegmentColors: segmentColors
    });
  },
  
  // 设置CSS变量
  setCssVariables: function(snakeColor) {
    // 创建样式对象
    const styles = {
      snakeColor: snakeColor,
      snakeBodyColor: this.lightenColor(snakeColor, 30)
    };
    
    // 将样式保存到data中
    this.setData(styles);
    
    // 更新实际页面上的样式
    setTimeout(() => {
      this.updateSnakeColors();
      this.updateFoodColors();
    }, 50);
  },
  
  // 更新蛇的颜色
  updateSnakeColors: function() {
    // 这个方法将在每次渲染蛇身体时被调用
    // 我们不能直接操作DOM，所以改用在页面呈现时设置样式
    // 实际不需要实现，因为在wxml中我们会使用内联样式
  },
  
  // 更新食物的颜色
  updateFoodColors: function() {
    // 这个方法将在每次渲染食物时被调用
    // 我们不能直接操作DOM，所以改用在页面呈现时设置样式
    // 实际不需要实现，因为在wxml中我们会使用内联样式
  },
  
  // 获取互补色
  getComplementaryColor: function(hex) {
    // 移除#号
    hex = hex.replace('#', '');
    
    // 转换为RGB
    let r = parseInt(hex.substring(0, 2), 16);
    let g = parseInt(hex.substring(2, 4), 16);
    let b = parseInt(hex.substring(4, 6), 16);
    
    // 计算互补色
    r = 255 - r;
    g = 255 - g;
    b = 255 - b;
    
    // 转回16进制
    return '#' + this.componentToHex(r) + this.componentToHex(g) + this.componentToHex(b);
  },
  
  // 辅助将RGB转为16进制
  componentToHex: function(c) {
    const hex = c.toString(16);
    return hex.length == 1 ? '0' + hex : hex;
  },
  
  // 使颜色变亮
  lightenColor: function(hex, amount) {
    return this.shadeColor(hex, amount);
  },
  
  // 使颜色变暗
  darkenColor: function(hex, amount) {
    return this.shadeColor(hex, -amount);
  },
  
  // 修改颜色亮度
  shadeColor: function(color, percent) {
    color = color.replace('#', '');
    
    const num = parseInt(color, 16);
    const r = (num >> 16) + percent;
    const g = ((num >> 8) & 0x00FF) + percent;
    const b = (num & 0x0000FF) + percent;
    
    const newR = Math.min(255, Math.max(0, r)).toString(16).padStart(2, '0');
    const newG = Math.min(255, Math.max(0, g)).toString(16).padStart(2, '0');
    const newB = Math.min(255, Math.max(0, b)).toString(16).padStart(2, '0');
    
    return `#${newR}${newG}${newB}`;
  },

  // 生成障碍物
  generateObstacles: function() {
    const obstacles = [];
    const size = this.data.boardSize;
    const obstacleCount = Math.floor(size / 3); // 根据棋盘大小生成适量障碍物
    
    for (let i = 0; i < obstacleCount; i++) {
      let obstacle;
      do {
        obstacle = {
          x: Math.floor(Math.random() * size),
          y: Math.floor(Math.random() * size)
        };
        // 确保障碍物不会出现在蛇的起始位置周围
      } while (
        (Math.abs(obstacle.x - 7) < 3 && Math.abs(obstacle.y - 7) < 3) ||
        this.isPositionInArray(obstacle, obstacles)
      );
      
      obstacles.push(obstacle);
    }
    
    return obstacles;
  },

  // 检查位置是否在数组中
  isPositionInArray: function(pos, array) {
    return array.some(item => item.x === pos.x && item.y === pos.y);
  },

  // 开始游戏
  startGame: function() {
    if (this.data.gameStatus !== 'playing') {
      this.setData({
        gameStatus: 'playing',
        countdown: 0
      });
      
      this.moveSnake();
      
      // 开始特殊食物生成定时器
      this.scheduleSpecialFood();
      
      // 如果是限时模式，启动倒计时
      if (this.data.gameMode === 'timed') {
        this.startTimeMode();
      }
    }
  },

  // 开始限时模式的计时
  startTimeMode: function() {
    const updateInterval = 100; // 100毫秒更新一次
    const totalTime = this.data.timeLimit * 1000; // 转换为毫秒
    let elapsedTime = 0;
    
    this.clearTimeTimer();
    
    const timer = setInterval(() => {
      if (this.data.gameStatus !== 'playing') return;
      
      elapsedTime += updateInterval;
      const remaining = 100 - (elapsedTime / totalTime * 100);
      
      this.setData({
        timeRemaining: remaining
      });
      
      if (remaining <= 0) {
        clearInterval(timer);
        this.timedModeEnd();
      }
    }, updateInterval);
    
    this.setData({
      timeTimer: timer
    });
  },

  // 限时模式结束
  timedModeEnd: function() {
    this.setData({
      gameStatus: 'gameover'
    });
    
    this.gameOver();
  },

  // 安排特殊食物出现
  scheduleSpecialFood: function() {
    this.clearSpecialFoodTimer();
    
    const timer = setTimeout(() => {
      if (this.data.gameStatus === 'playing') {
        this.generateSpecialFood();
      }
    }, this.data.specialFood.interval);
    
    this.setData({
      'specialFood.timer': timer
    });
  },

  // 生成特殊食物
  generateSpecialFood: function() {
    const size = this.data.boardSize;
    let specialFood;
    
    // 生成不与蛇身体、普通食物和障碍物重合的坐标
    do {
      specialFood = {
        x: Math.floor(Math.random() * size),
        y: Math.floor(Math.random() * size)
      };
    } while (
      this.isOnSnake(specialFood) || 
      (this.data.food.x === specialFood.x && this.data.food.y === specialFood.y) ||
      this.isPositionInArray(specialFood, this.data.obstacles)
    );
    
    // 为特殊食物生成一个随机且闪亮的颜色
    const specialColorIndex = Math.floor(Math.random() * this.data.foodColors.length);
    const specialBaseColor = this.data.foodColors[specialColorIndex];
    // 使颜色更亮，更闪亮
    const specialFoodColor = this.lightenColor(specialBaseColor, 40);
    
    // 更新特殊食物状态和颜色
    this.setData({
      specialFood: {
        ...this.data.specialFood,
        x: specialFood.x,
        y: specialFood.y,
        active: true,
        color: specialFoodColor,
        colorDark: this.darkenColor(specialFoodColor, 15)
      }
    });
    
    // 设置特殊食物消失定时器
    const timer = setTimeout(() => {
      this.setData({
        'specialFood.active': false
      });
      
      // 重新安排特殊食物出现
      this.scheduleSpecialFood();
    }, this.data.specialFood.duration);
    
    this.setData({
      'specialFood.timer': timer
    });
  },

  // 暂停游戏
  pauseGame: function() {
    if (this.data.gameStatus === 'playing') {
      this.setData({
        gameStatus: 'paused'
      });
      clearTimeout(this.data.interval);
      
      if (this.data.gameMode === 'timed') {
        this.clearTimeTimer();
      }
    }
  },

  // 重置游戏
  resetGame: function() {
    this.stopGame();
    this.initGame();
  },

  // 停止游戏
  stopGame: function() {
    if (this.data.interval) {
      clearTimeout(this.data.interval);
    }
    this.clearSpecialFoodTimer();
    this.clearTimeTimer();
  },

  // 生成随机食物位置
  generateFood: function(obstacles = []) {
    const size = this.data.boardSize;
    let food;
    
    do {
      food = {
        x: Math.floor(Math.random() * size),
        y: Math.floor(Math.random() * size)
      };
    } while (
      this.isOnSnake(food) || 
      this.isPositionInArray(food, obstacles)
    );

    // 为食物生成一个随机颜色
    const foodColorIndex = Math.floor(Math.random() * this.data.foodColors.length);
    const foodColor = this.data.foodColors[foodColorIndex];
    
    // 更新食物颜色
    this.setData({
      foodColor: foodColor,
      foodColorDark: this.darkenColor(foodColor, 20)
    });

    return food;
  },

  // 检查坐标是否在蛇身上
  isOnSnake: function(pos) {
    return this.data.snake.some(segment => segment.x === pos.x && segment.y === pos.y);
  },

  // 触发分数动画
  triggerScoreAnimation: function() {
    this.setData({
      scoreAnimation: true
    });
    
    setTimeout(() => {
      this.setData({
        scoreAnimation: false
      });
    }, 500);
  },

  // 移动蛇
  moveSnake: function() {
    if (this.data.gameStatus !== 'playing') {
      return;
    }

    const snake = [...this.data.snake];
    const head = {...snake[0]};
    const size = this.data.boardSize;

    // 根据方向移动蛇头
    switch(this.data.direction) {
      case 'up':
        head.y -= 1;
        break;
      case 'down':
        head.y += 1;
        break;
      case 'left':
        head.x -= 1;
        break;
      case 'right':
        head.x += 1;
        break;
    }

    // 边界处理
    if (this.data.boundaryMode) {
      // 穿越模式
      if (head.x < 0) head.x = size - 1;
      if (head.x >= size) head.x = 0;
      if (head.y < 0) head.y = size - 1;
      if (head.y >= size) head.y = 0;
    } else {
      // 撞墙检测
      if (head.x < 0 || head.x >= size || head.y < 0 || head.y >= size) {
        this.gameOver();
        return;
      }
    }

    // 撞到自己检测
    if (this.isOnSnake(head)) {
      this.gameOver();
      return;
    }
    
    // 撞到障碍物检测
    if (this.data.gameMode === 'obstacle' && this.isPositionInArray(head, this.data.obstacles)) {
      this.gameOver();
      return;
    }

    // 将新头部添加到蛇身体
    snake.unshift(head);

    // 检查是否吃到食物
    let addPoints = 0;
    let needNewFood = false;
    let eatenColor = null;
    
    // 普通食物
    if (head.x === this.data.food.x && head.y === this.data.food.y) {
      addPoints = 1;
      needNewFood = true;
      eatenColor = this.data.foodColor;
      
      // 食物被吃掉时触发闪光效果
      this.foodGlowEffect();
    }
    
    // 特殊食物
    else if (this.data.specialFood.active && head.x === this.data.specialFood.x && head.y === this.data.specialFood.y) {
      addPoints = this.data.specialFood.points;
      eatenColor = this.data.specialFood.color;
      
      // 特殊食物被吃掉时触发超级闪光效果
      this.specialFoodGlowEffect();
      
      this.setData({
        'specialFood.active': false
      });
      
      this.clearSpecialFoodTimer();
      this.scheduleSpecialFood();
    }
    
    if (addPoints > 0) {
      // 吃到食物，加分并触发动画
      const newScore = this.data.score + addPoints;
      this.setData({
        score: newScore
      });
      
      this.triggerScoreAnimation();
      
      // 使用吃到的食物颜色添加新节点
      this.addColorForNewSegment(eatenColor);
      
      // 如果需要生成新的普通食物
      if (needNewFood) {
        this.setData({
          food: this.generateFood(this.data.obstacles)
        });
      }
      
      // 删除自动加速逻辑，改为用户手动控制
    } else {
      // 没吃到食物，移除尾部
      snake.pop();
    }

    // 更新蛇的位置
    this.setData({
      snake: snake
    });

    // 继续移动
    const interval = setTimeout(() => {
      this.moveSnake();
    }, this.data.speed);

    this.setData({
      interval: interval
    });
  },
  
  // 当蛇吃到食物变长时，使用食物的颜色
  addColorForNewSegment: function(foodColor) {
    const segmentColors = [...this.data.snakeSegmentColors];
    // 使用传入的食物颜色，如果没有则使用随机颜色
    const colorToAdd = foodColor || this.data.snakeColors[Math.floor(Math.random() * this.data.snakeColors.length)];
    segmentColors.unshift(colorToAdd);
    
    this.setData({
      snakeSegmentColors: segmentColors
    });
  },

  // 食物闪光效果
  foodGlowEffect: function() {
    // 食物闪光效果 - 暂时增强食物的亮度
    const originalFoodColor = this.data.foodColor;
    const brighterColor = this.lightenColor(originalFoodColor, 50);
    
    // 短暂设置更亮的颜色
    this.setData({
      temporaryFoodColor: brighterColor,
      isFoodGlowing: true
    });
    
    // 0.3秒后恢复
    setTimeout(() => {
      this.setData({
        temporaryFoodColor: originalFoodColor,
        isFoodGlowing: false
      });
    }, 300);
  },
  
  // 特殊食物闪光效果
  specialFoodGlowEffect: function() {
    // 特殊食物被吃掉时的超级亮闪效果
    // 这只是设置一个状态，在CSS中我们已经定义好了动画
    this.setData({
      isSpecialFoodGlowing: true
    });
    
    // 0.5秒后恢复
    setTimeout(() => {
      this.setData({
        isSpecialFoodGlowing: false
      });
    }, 500);
  },

  // 游戏结束
  gameOver: function() {
    this.setData({
      gameStatus: 'gameover'
    });
    this.stopGame();
    
    // 检查是否为新高分
    const isHighScore = this.data.score > this.data.highScore;
    if (isHighScore) {
      wx.setStorageSync('snakeHighScore', this.data.score);
      this.setData({
        highScore: this.data.score,
        isHighScore: true
      });
    }
  },

  // 处理方向控制
  handleDirectionChange: function(e) {
    const direction = e.currentTarget.dataset.direction;
    const currentDirection = this.data.direction;
    
    // 如果游戏处于暂停状态且用户开始操作方向，自动开始游戏
    if (this.data.gameStatus === 'paused') {
      this.startGame();
    }
    
    // 防止反向移动（例如向右移动时不能直接向左）
    if (
      (direction === 'left' && currentDirection !== 'right') ||
      (direction === 'right' && currentDirection !== 'left') ||
      (direction === 'up' && currentDirection !== 'down') ||
      (direction === 'down' && currentDirection !== 'up')
    ) {
      this.setData({
        direction: direction
      });
    }
  },

  // 切换边界模式
  toggleBoundaryMode: function() {
    this.setData({
      boundaryMode: !this.data.boundaryMode
    });
  },

  // 处理滑动手势
  handleTouchStart: function(e) {
    // 如果游戏处于暂停状态且用户开始操作，自动开始游戏
    if (this.data.gameStatus === 'paused') {
      this.startGame();
      return;
    }
    
    if (this.data.gameStatus !== 'playing') {
      return;
    }
    
    this.startX = e.touches[0].pageX;
    this.startY = e.touches[0].pageY;
  },

  handleTouchEnd: function(e) {
    if (this.data.gameStatus !== 'playing') {
      return;
    }
    
    const endX = e.changedTouches[0].pageX;
    const endY = e.changedTouches[0].pageY;
    
    const deltaX = endX - this.startX;
    const deltaY = endY - this.startY;
    
    // 判断滑动方向，提高灵敏度
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      // 水平滑动
      if (deltaX > 20 && this.data.direction !== 'left') {
        this.setData({ direction: 'right' });
      } else if (deltaX < -20 && this.data.direction !== 'right') {
        this.setData({ direction: 'left' });
      }
    } else {
      // 垂直滑动
      if (deltaY > 20 && this.data.direction !== 'up') {
        this.setData({ direction: 'down' });
      } else if (deltaY < -20 && this.data.direction !== 'down') {
        this.setData({ direction: 'up' });
      }
    }
  },

  // 手动调整速度
  changeSpeed: function(e) {
    const action = e.currentTarget.dataset.action;
    let newSpeed = this.data.speed;
    
    if (action === 'increase' && this.data.speed > 100) {
      // 加速 (降低间隔时间)
      newSpeed = this.data.speed - 50;
    } else if (action === 'decrease' && this.data.speed < 500) {
      // 减速 (增加间隔时间)
      newSpeed = this.data.speed + 50;
    }
    
    this.setData({
      speed: newSpeed
    });
  },

  // 分享给朋友
  onShareAppMessage: function() {
    return {
      title: '来挑战我的贪吃蛇得分: ' + this.data.score,
      imageUrl: '/images/snake_share.png', // 可选，自定义分享图片
      path: '/miniprogram/pages/snake/snake'
    }
  },
  
  // 分享到朋友圈
  onShareTimeline: function() {
    return {
      title: '来挑战我的贪吃蛇得分: ' + this.data.score,
      imageUrl: '/images/snake_share.png', // 可选，自定义分享图片
      query: ''
    }
  },
}); 