module Menu exposing (view)

import Element
import Element.Background as Background
import Element.Border as Border
import Element.Events as Events


view :
    (Maybe String -> Bool -> msg)
    -> List String
    -> Maybe String
    -> Element.Element msg
view toMsg items active =
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
        , Events.onClick <| toMsg active True
        ]
        (items
            |> List.map
                (\label ->
                    if label == "--" then
                        viewSeparator

                    else
                        viewItem
                            (toMsg (Just label) False)
                            (toMsg Nothing False)
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
