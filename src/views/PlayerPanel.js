import Cancelable from '@enact/ui/Cancelable'
import PropTypes from 'prop-types'
import Player from '../components/player/Player'
import back from '../back'
import { updateAppTitle } from '../appTitle';

const PlayerPanelBase = ({...rest}) => {
    delete rest.hideChildren
    return (
        <Player {...rest} />
    )
}

Player.propTypes = {
    backHome: PropTypes.func,
}

// Update handleCancel to reset the title when exiting the player
const handleCancel = (ev) => {
    ev.stopPropagation()
    // Reset the app title when leaving the player
    updateAppTitle('');
    back.doBack()
}

const PlayerPanel = Cancelable(
    { modal: true, onCancel: handleCancel },
    PlayerPanelBase
)

export default PlayerPanel