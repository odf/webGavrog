module Menu exposing (Config, Result, State, init, view)

import Element
import Element.Background as Background
import Element.Border as Border
import Element.Events as Events


type State
    = Internals (Maybe String)


type alias Config =
    List String


type alias Result =
    Maybe String


init : State
init =
    Internals Nothing


view : (State -> Result -> msg) -> Config -> State -> Element.Element msg
view toMsg items (Internals active) =
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
        (items
            |> List.map
                (\label ->
                    if label == "--" then
                        viewSeparator

                    else
                        viewItem
                            (toMsg (Internals (Just label)) Nothing)
                            (toMsg (Internals Nothing) Nothing)
                            (active == Just label)
                            label
                )
        )


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


viewItem : msg -> msg -> Bool -> String -> Element.Element msg
viewItem msgEnter msgLeave isActive label =
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
        (Element.text label)
