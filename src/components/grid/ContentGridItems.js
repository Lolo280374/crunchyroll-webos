import { useCallback, useEffect, useRef, useMemo } from 'react'
import Spinner from '@enact/moonstone/Spinner'
import { VirtualGridList } from '@enact/moonstone/VirtualList'
import GridListImageItem from '@enact/moonstone/GridListImageItem'
import ri from '@enact/ui/resolution'
import { useRecoilValue } from 'recoil'
import PropTypes from 'prop-types'

import LoadingList from '../LoadingList'
import { homePositionState } from '../../recoilConfig'
import useGetImagePerResolution from '../../hooks/getImagePerResolution'
import { useSetContent } from '../../hooks/setContent'
// Import our new utilities
import getGridConfig from '../../utils/gridConfig'
import OptimizedImage from '../OptimizedImage' // Import our optimized image component

/**
 * Show grid of items
 * @param {Object} obj
 * @param {Array<Object>} obj.contentList
 * @param {Function} [obj.load]
 * @param {Boolean} [obj.autoScroll]
 * @param {Function} [obj.onFocus]
 * @param {'tall'|'wide'} [obj.mode]
 * @param {Function} obj.onLeave
 * @param {Object} obj.homePositionOverride
 */
const ContentGridItems = ({ contentList, load, autoScroll = true, onFocus, mode = 'tall', onLeave, onSelect,
    homePositionOverride, section = 'home', ...rest }) => {
    /** @type {{current: Function}} */
    const scrollToRef = useRef(null)
    /** @type {{current: Number}} */
    const rowIndexRef = useRef(null)
    /** @type {{rowIndex: Number, columnIndex: Number}} */
    const homePosition = useRecoilValue(homePositionOverride || homePositionState)
    /** @type {Function} */
    const getImagePerResolution = useGetImagePerResolution()
    /** @type {Function} */
    const setContentNavagate = useSetContent()

    // Get grid configuration based on section and device
    const gridConfig = useMemo(() => getGridConfig(section), [section]);
    
    // Calculate item dimensions based on mode and optimized for device
    const [itemHeight, itemWidth] = useMemo(() => {
        const isLegacyWebOS = window.webOS && 
            window.webOS.device && 
            (parseFloat(window.webOS.device.platformVersion) <= 4);

        // Scale down item sizes slightly for WebOS 3.5 to improve performance
        const scaleFactor = isLegacyWebOS ? 0.9 : 1.0;
        
        return mode === 'tall' 
            ? [ri.scale(390 * scaleFactor), ri.scale(240 * scaleFactor)] 
            : [ri.scale(270 * scaleFactor), ri.scale(320 * scaleFactor)]
    }, [mode]);

    /** @type {Function} */
    const getScrollTo = useCallback((scrollTo) => { scrollToRef.current = scrollTo }, [])

    /** @type {Function} */
    const onSelectItem = useCallback((ev) => {
        if (ev.currentTarget) {
            const index = parseInt(ev.currentTarget.dataset['index'])
            onLeave()  // for first if must be before
            if (onSelect) {
                onSelect({ content: contentList[index], rowIndex: index })
            } else {
                setContentNavagate({ content: contentList[index], rowIndex: index })
            }
        }
    }, [contentList, setContentNavagate, onLeave, onSelect])

    // Limit visible items for WebOS 3.5
    const optimizedContentList = useMemo(() => {
        const isLegacyWebOS = window.webOS && 
            window.webOS.device && 
            (parseFloat(window.webOS.device.platformVersion) <= 4);
        
        if (isLegacyWebOS && contentList && gridConfig.maxVisibleItems) {
            // Keep some extra items for infinite scrolling
            const visibleCount = gridConfig.maxVisibleItems + gridConfig.preloadOffscreenItems;
            
            // If original list is smaller than our limit, use it directly
            if (contentList.length <= visibleCount) {
                return contentList;
            }
            
            // Otherwise, slice it to our defined limit
            return contentList.slice(0, visibleCount);
        }
        
        return contentList;
    }, [contentList, gridConfig]);

    /** @type {Function} */
    const renderItem = useCallback(({ index, ...rest2 }) => {
        let out;
        // Use optimized list for rendering
        const contentItem = optimizedContentList[index];
        if (contentItem) {
            const image = getImagePerResolution({
                height: itemHeight,
                content: contentItem,
                mode
            });
            
            // Use modified GridListImageItem with OptimizedImage
            out = (
                <GridListImageItem
                    {...rest2}
                    data-index={index}
                    source={image.source}
                    caption={(contentItem.title || '').replace(/\n/g, "")}
                    subCaption={(contentItem.description || '').replace(/\n/g, "")}
                    onClick={onSelectItem}
                    onFocus={onFocus}
                    // This is important - it allows image replacement with our optimized image
                    imageComponent={(imgProps) => (
                        <OptimizedImage {...imgProps} />
                    )}
                />
            );
        } else {
            if (load) {
                load(index);
            }
            out = (
                <div {...rest2}>
                    <Spinner />
                </div>
            );
        }
        return out;
    }, [optimizedContentList, itemHeight, getImagePerResolution, onSelectItem, onFocus, load, mode]);

    useEffect(() => {
        if (contentList != null) {
            if (autoScroll && contentList.length > 0) {
                rowIndexRef.current = Math.min(homePosition.rowIndex, contentList.length - 1)
            } else {
                rowIndexRef.current = false
            }
        }
    }, [autoScroll, homePosition.rowIndex, contentList])

    useEffect(() => {
        const interval = setInterval(() => {
            if (scrollToRef.current) {
                if (rowIndexRef.current !== null && rowIndexRef.current !== false) {
                    clearInterval(interval)
                    scrollToRef.current({ index: rowIndexRef.current, animate: false, focus: true })
                } else if (rowIndexRef.current === false) {
                    clearInterval(interval)
                }
            }
        }, 100)
        return () => {
            clearInterval(interval)
            scrollToRef.current = null
        }
    }, [])

    return (
        <LoadingList
            list={optimizedContentList}
            index={homePosition.rowIndex}
            scrollFn={scrollToRef.current}>
            {optimizedContentList && optimizedContentList.length > 0 &&
                <VirtualGridList {...rest}
                    dataSize={optimizedContentList.length}
                    itemRenderer={renderItem}
                    itemSize={{ minHeight: itemHeight, minWidth: itemWidth }}
                    // Use optimized spacing from grid config
                    spacing={ri.scale(gridConfig.spacing)}
                    // Ensure we only set visible items within viewport + a small buffer
                    overhang={1}  // Reduced from default to improve performance
                    cbScrollTo={getScrollTo}
                />
            }
        </LoadingList>
    )
}

// Update propTypes to include section
ContentGridItems.propTypes = {
    contentList: PropTypes.oneOfType([
        PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.object, PropTypes.bool])),
        PropTypes.oneOf([null]),
    ]),
    onLeave: PropTypes.func.isRequired,
    autoScroll: PropTypes.bool,
    mode: PropTypes.oneOf(['tall', 'wide']),
    load: PropTypes.func,
    onFocus: PropTypes.func,
    onSelect: PropTypes.func,
    homePositionOverride: PropTypes.any,
    section: PropTypes.string // Added this prop
}

export default ContentGridItems