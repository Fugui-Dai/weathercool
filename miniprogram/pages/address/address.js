// pages/address/address.js

// index.js
import '../../utils/extendApi'
import WxRequest from 'mina-request'

// 对 WxRequest 进行实例化
const instance = new WxRequest({
    baseURL: 'https://devapi.qweather.com', // 使用时请换成真实接口
    timeout: 1000, // 超时时长
    isLoading: false // 是否使用默认的 loading 效果
})
const instanceGeoapi = new WxRequest({
    baseURL: 'https://geoapi.qweather.com', // 使用时请换成真实接口
    timeout: 1000, // 超时时长
    isLoading: false // 是否使用默认的 loading 效果
})
let debounceTimer = null; // 防抖动定时器
Page({
    /**
     * 页面的初始数据
     */
    data: {
        // 搜索框内容
        searchValue: "",
        // 城市搜索结果
        cityList: [],
        //热门城市的数据
        hotCities: [],
        // 刷新状态
        refreshing: false
    },

    // 下拉刷新处理函数
    async onRefresh() {
        // 设置刷新状态
        this.setData({
            refreshing: true
        });
        
        try {
            // 重新获取热门城市数据
            await this.locationAndSearch();
            
            // 如果当前有搜索内容，重新搜索
            if (this.data.searchValue) {
                const simulatedEvent = {
                    detail: {
                        value: this.data.searchValue
                    }
                };
                await this.onInput(simulatedEvent);
            }
            
            // 不显示刷新成功提示
        } catch (error) {
            console.error("刷新失败:", error);
            // 不显示刷新失败提示
        } finally {
            // 结束刷新状态
            this.setData({
                refreshing: false
            });
        }
    },

    // 定位和搜索
    async locationAndSearch() {
        // 热门城市
        const hotcity = await instanceGeoapi.get('/v2/city/top', {
            number: 12, range: 'cn', key: "2d57f1cc456d421c8bbdd925db34555a"
        })
        //console.log("热门城市", hotcity);
        this.setData({
            // 热门城市
            hotCities: hotcity.data.topCityList // 存储返回的城市数据
        })
    },
    // 返回
    clickBack() {
        // 关闭当前页面，返回上一页面或多级页面
        wx.navigateBack()
    },
    // 搜索框
    onInput(e) {
        const value = e.detail.value ? e.detail.value.trim() : ""; // 确保 `value` 不为空
        console.log("输入值：", value);
        this.setData({
            searchValue: value
        });
        // 如果有防抖定时器，清除它
        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }
        // 设置防抖定时器
        debounceTimer = setTimeout(async () => {
            if (value) {
                try {
                    // 城市搜索请求
                    const citySearch = await instanceGeoapi.get('/v2/city/lookup', {
                        location: value, number: 20, range: 'cn', key: "2d57f1cc456d421c8bbdd925db34555a"
                    });
                    console.log("城市搜索", citySearch.data.location[0]);
                    // 请求成功后，更新城市列表
                    console.log('成功')
                    this.setData({
                        cityList: citySearch.data.location
                    });
                } catch (error) {
                    console.error("城市搜索失败:", error);
                }
            } else {
                // 如果输入为空，清空列表
                this.setData({
                    cityList: []
                });
            }
        }, 500); // 防抖延时500ms
    },
    // 点击选择城市
    onSelectCity(e) {
        const selectedCity = e.currentTarget.dataset.city;
        console.log("选中的城市：", selectedCity);
        this.setData({
            searchValue: selectedCity.name, // 更新搜索框内容为所选城市名称
            cityList: [] // 隐藏城市列表
        });
        const pages = getCurrentPages(); // 获取页面栈
        const prevPage = pages[pages.length - 2]; // 上一个页面（index 页面）
        // 直接修改 index 页面的数据，传递整个对象
        prevPage.setData({
            selectedCity: selectedCity // 将选中的城市名称传递回 index 页面
        });
        // 跳转回 index 页面并传递城市名称
        wx.navigateBack();
    },
    // 点击选择热门城市
    onSelectHotCity(e) {
        const selectedCity = e.currentTarget.dataset.city;
        console.log("点击的热门城市：", selectedCity); // 获取点击的热门城市对象
        this.setData({
            searchValue: selectedCity.name, // 更新搜索框内容为所选热门城市名称
            cityList: [] // 隐藏城市列表
        });
        // 创建一个模拟的事件对象
        const simulatedEvent = {
            detail: {
                value: selectedCity.name // 模拟输入框的内容
            }
        };
        this.onInput(simulatedEvent)
    },
    /**
     * 生命周期函数--监听页面加载
     */
    onLoad() {
        this.locationAndSearch();
        // 页面触摸事件监听
        wx.createSelectorQuery().select('.scrollarea').boundingClientRect(rect => {
            wx.pageScrollTo({
                scrollTop: rect.top,
            });
        }).exec();

        // 点击外部区域时，隐藏城市列表
        wx.createSelectorQuery().select('.container').boundingClientRect((rect) => {
            wx.onTouchStart(e => {
                const listBox = this.selectComponent('.city-list');
                if (!listBox || !listBox.contains(e.target)) {
                    this.setData({
                        cityList: [] // 点击外部区域时，隐藏城市列表
                    });
                }
            });
        }).exec();
    },

    /**
     * 生命周期函数--监听页面初次渲染完成
     */
    onReady() {

    },

    /**
     * 生命周期函数--监听页面显示
     */
    onShow() {

    },

    /**
     * 生命周期函数--监听页面隐藏
     */
    onHide() {

    },

    /**
     * 生命周期函数--监听页面卸载
     */
    onUnload() {

    },

    /**
     * 页面相关事件处理函数--监听用户下拉动作
     */
    onPullDownRefresh() {

    },

    /**
     * 页面上拉触底事件的处理函数
     */
    onReachBottom() {

    },

    /**
     * 用户点击右上角分享
     */
    onShareAppMessage() {

    }
})