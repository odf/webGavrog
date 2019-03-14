module Menu exposing (Config, Entry(..), Item, Result, State, init, view)

import Element
import Element.Background as Background
import Element.Border as Border
import Element.Events as Events


type alias Item =
    String


type State
    = Internals (Maybe Item)


type Entry
    = Separator
    | Choice Item


type alias Config =
    List Entry


type alias Result =
    Maybe Item


init : State
init =
    Internals Nothing


view : (State -> Result -> msg) -> Config -> State -> Element.Element msg
view toMsg entries (Internals active) =
    Element.column
        [ Element.alignLeft
        , Element.paddingXY 0 4
        , Background.color <| Element.rgb255 255 255 255
        , Border.color <| Element.rgb255 170 170 170
        , Border.width 1
        , Border.shadow
            { offset = ( 0.0, 8.0 )
            , size = 0.0
            , blur = 16.0
            , color = Element.rgba 0.0 0.0 0.0 0.2
            }
        , Events.onClick <| toMsg (Internals active) active
        ]
        (List.map (viewItem toMsg (Internals active)) entries)


viewItem : (State -> Result -> msg) -> State -> Entry -> Element.Element msg
viewItem toMsg (Internals active) entry =
    case entry of
        Separator ->
            viewSeparator

        Choice item ->
            viewChoice
                (toMsg (Internals (Just item)) Nothing)
                (toMsg (Internals Nothing) Nothing)
                (active == Just item)
                item


viewSeparator : Element.Element msg
viewSeparator =
    Element.el
        [ Element.width Element.fill
        , Element.paddingXY 0 4
        ]
        (Element.el
            [ Element.width Element.fill
            , Element.height <| Element.px 1
            , Background.color <| Element.rgb255 170 170 170
            ]
            Element.none
        )


viewChoice : msg -> msg -> Bool -> Item -> Element.Element msg
viewChoice msgEnter msgLeave isActive item =
    let
        color =
            if isActive then
                Element.rgb255 170 170 170

            else
                Element.rgb255 255 255 255
    in
    Element.el
        [ Element.width Element.fill
        , Events.onMouseEnter msgEnter
        , Events.onMouseLeave msgLeave
        , Element.paddingXY 16 4
        , Background.color color
        ]
        (Element.text item)
